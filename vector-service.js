const { Pinecone } = require('@pinecone-database/pinecone');

class VectorService {
  constructor() {
    this.apiKey = process.env.PINECONE_API_KEY;
    this.environment = process.env.PINECONE_ENVIRONMENT;
    this.indexName = process.env.PINECONE_INDEX_NAME || 'whatsapp-user-data';
    this.isAvailable = !!this.apiKey;
    
    if (this.isAvailable) {
      this.pinecone = new Pinecone({
        apiKey: this.apiKey,
        environment: this.environment
      });
      this.index = null;
    } else {
      console.warn('⚠️  Pinecone API key not found. Running without vector storage.');
    }
  }

  // Initialize the Pinecone index
  async initializeIndex() {
    if (!this.isAvailable) {
      console.log('📝 Vector storage not available - using fallback storage');
      return false;
    }

    try {
      this.index = this.pinecone.index(this.indexName);
      console.log('✅ Pinecone index initialized:', this.indexName);
      return true;
    } catch (error) {
      console.error('❌ Error initializing Pinecone index:', error);
      return false;
    }
  }

  // Generate embeddings for text (using a simple hash-based approach for demo)
  // In production, you'd use OpenAI embeddings or another embedding service
  generateEmbedding(text) {
    // Simple hash-based embedding for demo purposes
    // In production, use proper embedding models
    const hash = this.simpleHash(text);
    const embedding = new Array(1536).fill(0);
    
    // Distribute hash across embedding dimensions
    for (let i = 0; i < 16; i++) {
      const pos = (hash + i * 97) % 1536;
      embedding[pos] = Math.sin(hash / (i + 1)) * 0.1;
    }
    
    return embedding;
  }

  // Simple hash function for demo
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  // Store user data in vector database
  async storeUserData(phoneNumber, userName, dataType, content, metadata = {}) {
    if (!this.isAvailable) {
      console.log('📝 Storing data locally (vector storage not available)');
      return this.storeLocally(phoneNumber, userName, dataType, content, metadata);
    }

    try {
      const embedding = this.generateEmbedding(content);
      const vectorId = `${phoneNumber}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const vectorData = {
        id: vectorId,
        values: embedding,
        metadata: {
          phoneNumber,
          userName,
          dataType, // 'name', 'preference', 'birthday', 'phone', 'interest', etc.
          content,
          timestamp: new Date().toISOString(),
          ...metadata
        }
      };

      await this.index.upsert([vectorData]);
      console.log('✅ Data stored in vector database:', {
        phoneNumber,
        userName,
        dataType,
        content: content.substring(0, 50) + '...'
      });

      return vectorId;
    } catch (error) {
      console.error('❌ Error storing data in vector database:', error);
      return this.storeLocally(phoneNumber, userName, dataType, content, metadata);
    }
  }

  // Fallback local storage when Pinecone is not available
  storeLocally(phoneNumber, userName, dataType, content, metadata = {}) {
    const data = {
      phoneNumber,
      userName,
      dataType,
      content,
      timestamp: new Date().toISOString(),
      ...metadata
    };

    // Store in a simple in-memory structure (in production, use a database)
    if (!global.userDataStore) {
      global.userDataStore = new Map();
    }

    const userKey = phoneNumber;
    if (!global.userDataStore.has(userKey)) {
      global.userDataStore.set(userKey, []);
    }

    global.userDataStore.get(userKey).push(data);
    console.log('📝 Data stored locally:', data);
    return `local_${Date.now()}`;
  }

  // Retrieve user data from vector database
  async retrieveUserData(phoneNumber, query = null, limit = 10) {
    if (!this.isAvailable) {
      console.log('📝 Retrieving data from local storage');
      return this.retrieveLocally(phoneNumber, query, limit);
    }

    try {
      let queryVector;
      if (query) {
        queryVector = this.generateEmbedding(query);
      } else {
        // Use a general query to get all user data
        queryVector = this.generateEmbedding(`user ${phoneNumber} data`);
      }

      const queryResponse = await this.index.query({
        vector: queryVector,
        filter: { phoneNumber: { $eq: phoneNumber } },
        topK: limit,
        includeMetadata: true
      });

      const results = queryResponse.matches.map(match => ({
        id: match.id,
        score: match.score,
        ...match.metadata
      }));

      console.log(`✅ Retrieved ${results.length} data points for user ${phoneNumber}`);
      return results;
    } catch (error) {
      console.error('❌ Error retrieving data from vector database:', error);
      return this.retrieveLocally(phoneNumber, query, limit);
    }
  }

  // Fallback local retrieval
  retrieveLocally(phoneNumber, query = null, limit = 10) {
    if (!global.userDataStore || !global.userDataStore.has(phoneNumber)) {
      return [];
    }

    let userData = global.userDataStore.get(phoneNumber);
    
    if (query) {
      // Simple text matching for local storage
      userData = userData.filter(item => 
        item.content.toLowerCase().includes(query.toLowerCase()) ||
        item.dataType.toLowerCase().includes(query.toLowerCase())
      );
    }

    return userData.slice(0, limit);
  }

  // Get user profile summary
  async getUserProfile(phoneNumber) {
    const userData = await this.retrieveUserData(phoneNumber);
    
    const profile = {
      phoneNumber,
      name: null,
      preferences: [],
      personalInfo: [],
      interests: [],
      contactInfo: []
    };

    userData.forEach(item => {
      switch (item.dataType) {
        case 'name':
          profile.name = item.content;
          break;
        case 'preference':
          profile.preferences.push(item.content);
          break;
        case 'interest':
          profile.interests.push(item.content);
          break;
        case 'birthday':
        case 'phone':
          profile.contactInfo.push(`${item.dataType}: ${item.content}`);
          break;
        default:
          profile.personalInfo.push(item.content);
      }
    });

    return profile;
  }

  // Search for similar data across all users (for analytics)
  async searchSimilarData(query, limit = 5) {
    if (!this.isAvailable) {
      console.log('📝 Similar data search not available in local mode');
      return [];
    }

    try {
      const queryVector = this.generateEmbedding(query);
      
      const queryResponse = await this.index.query({
        vector: queryVector,
        topK: limit,
        includeMetadata: true
      });

      return queryResponse.matches.map(match => ({
        id: match.id,
        score: match.score,
        ...match.metadata
      }));
    } catch (error) {
      console.error('❌ Error searching similar data:', error);
      return [];
    }
  }
}

module.exports = VectorService;
