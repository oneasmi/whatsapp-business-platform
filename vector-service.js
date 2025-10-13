const { Pinecone } = require('@pinecone-database/pinecone');

class VectorService {
  constructor() {
    this.apiKey = process.env.PINECONE_API_KEY;
    this.indexName = process.env.PINECONE_INDEX_NAME || 'whatsapp-user-data';
    this.isAvailable = !!this.apiKey;
    
    if (this.isAvailable) {
      this.pinecone = new Pinecone({
        apiKey: this.apiKey
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

  // Extract clean information from stored content
  extractDateFromContent(content) {
    // Remove common prefixes and extract just the date
    let cleanContent = content
      .replace(/^(my birthday is|i was born on|birthday is|born on)/i, '')
      .replace(/^(i am born on|i'm born on)/i, '')
      .trim();
    
    return cleanContent;
  }

  // Extract clean phone number from content
  extractPhoneFromContent(content) {
    // Remove common prefixes and extract just the number
    let cleanContent = content
      .replace(/^(my phone number is|phone number is|my number is|number is)/i, '')
      .replace(/^(i am|i'm)/i, '')
      .trim();
    
    return cleanContent;
  }

  // Extract clean name from content
  extractNameFromContent(content) {
    // Remove common prefixes and extract just the name
    let cleanContent = content
      .replace(/^(my name is|name is|i am|i'm)/i, '')
      .trim();
    
    return cleanContent;
  }

  // Extract clean preference from content
  extractCleanPreference(content) {
    // Remove common prefixes and extract just the preference
    let cleanContent = content
      .replace(/^(i like|i love|i prefer|like|love|prefer)/i, '')
      .trim();
    
    return cleanContent;
  }

  // Extract clean work information from content
  extractCleanWork(content) {
    // Remove common prefixes and extract just the work info
    let cleanContent = content
      .replace(/^(i work as|i work at|i am a|i'm a|work as|work at)/i, '')
      .replace(/^(i am|i'm)/i, '')
      .trim();
    
    return cleanContent;
  }

  // Extract clean identity from content
  extractCleanIdentity(content) {
    // Remove common prefixes and extract just the identity
    let cleanContent = content
      .replace(/^(i am a|i'm a|i am|i'm)/i, '')
      .trim();
    
    return cleanContent;
  }

  // Check if data already exists and needs updating
  async checkForExistingData(phoneNumber, dataType, newContent, person = null) {
    try {
      const userData = await this.retrieveUserData(phoneNumber);
      
      // Filter by data type and person (if specified)
      let filteredData = userData.filter(item => item.dataType === dataType);
      
      if (person) {
        // Check if this is for a specific person
        filteredData = filteredData.filter(item => 
          item.person === person || 
          item.metadata?.person === person ||
          item.content.toLowerCase().includes(person.toLowerCase())
        );
      } else {
        // For self data, only check self entries (no person specified)
        filteredData = filteredData.filter(item => 
          !item.person && !item.metadata?.person
        );
      }
      
      const existingData = filteredData
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0]; // Get most recent
      
      if (existingData) {
        return {
          exists: true,
          existingContent: existingData.content,
          existingId: existingData.id
        };
      }
      
      return { exists: false };
    } catch (error) {
      console.error('❌ Error checking for existing data:', error);
      return { exists: false };
    }
  }

  // Update existing data
  async updateUserData(phoneNumber, userName, dataType, newContent, existingId, metadata = {}) {
    if (!this.isAvailable) {
      console.log('📝 Updating data locally (vector storage not available)');
      return this.updateLocally(phoneNumber, userName, dataType, newContent, existingId, metadata);
    }

    try {
      const embedding = this.generateEmbedding(newContent);
      
      const vectorData = {
        id: existingId,
        values: embedding,
        metadata: {
          phoneNumber,
          userName,
          dataType,
          content: newContent,
          timestamp: new Date().toISOString(),
          updated: true,
          ...metadata
        }
      };

      await this.index.upsert([vectorData]);
      console.log('✅ Data updated in vector database:', {
        phoneNumber,
        userName,
        dataType,
        content: newContent.substring(0, 50) + '...'
      });

      return existingId;
    } catch (error) {
      console.error('❌ Error updating data in vector database:', error);
      return this.updateLocally(phoneNumber, userName, dataType, newContent, existingId, metadata);
    }
  }

  // Fallback local update
  updateLocally(phoneNumber, userName, dataType, newContent, existingId, metadata = {}) {
    if (!global.userDataStore || !global.userDataStore.has(phoneNumber)) {
      return null;
    }

    const userData = global.userDataStore.get(phoneNumber);
    const existingIndex = userData.findIndex(item => item.id === existingId);
    
    if (existingIndex !== -1) {
      userData[existingIndex] = {
        ...userData[existingIndex],
        content: newContent,
        timestamp: new Date().toISOString(),
        updated: true,
        ...metadata
      };
      console.log('📝 Data updated locally:', userData[existingIndex]);
      return existingId;
    }
    
    return null;
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
    const id = `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const data = {
      id,
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
    return id;
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

  // Answer user questions about their stored data
  async answerUserQuestion(phoneNumber, question) {
    try {
      const userData = await this.retrieveUserData(phoneNumber);
      const questionLower = question.toLowerCase();
      
      // Check for questions about other people's data first (generic)
      const otherPersonMatch = question.match(/(?:when\s+is|what'?s?)\s+(\w+)'s\s+(\w+)/i);
      if (otherPersonMatch) {
        const personName = otherPersonMatch[1];
        const dataType = otherPersonMatch[2].toLowerCase();
        
        // Map common data types
        const dataTypeMapping = {
          'birthday': 'birthday',
          'bday': 'birthday',
          'phone': 'phone',
          'number': 'phone',
          'name': 'name',
          'job': 'work',
          'work': 'work',
          'preference': 'preference',
          'like': 'preference'
        };
        
        const mappedDataType = dataTypeMapping[dataType] || dataType;
        
        const personData = userData
          .filter(item => item.dataType === mappedDataType && 
                         (item.person === personName || item.metadata?.person === personName))
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
        
        if (personData) {
          let cleanContent = personData.content;
          
          // Clean content based on data type
          if (mappedDataType === 'birthday') {
            cleanContent = this.extractDateFromContent(personData.content);
          } else if (mappedDataType === 'phone') {
            cleanContent = this.extractPhoneFromContent(personData.content);
          } else if (mappedDataType === 'name') {
            cleanContent = this.extractNameFromContent(personData.content);
          }
          
          return `${personName}'s ${dataType} is ${cleanContent}`;
        } else {
          return `I don't know ${personName}'s ${dataType}. Please tell me ${personName}'s ${dataType} so I can remember it.`;
        }
      }

      // Check for specific data types
      if (questionLower.includes('birthday') || questionLower.includes('born')) {
        // Filter for user's own birthday (no person specified)
        const birthdayData = userData
          .filter(item => item.dataType === 'birthday' && !item.person && !item.metadata?.person)
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0]; // Get most recent
        if (birthdayData) {
          // Extract just the date from the stored content
          const cleanDate = this.extractDateFromContent(birthdayData.content);
          return `Your birthday is ${cleanDate}`;
        } else {
          return "I don't know your birthday. Please tell me your birthday so I can remember it.";
        }
      }
      
      if (questionLower.includes('phone') || questionLower.includes('number')) {
        // Filter for user's own phone (no person specified)
        const phoneData = userData
          .filter(item => item.dataType === 'phone' && !item.person && !item.metadata?.person)
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0]; // Get most recent
        if (phoneData) {
          const cleanPhone = this.extractPhoneFromContent(phoneData.content);
          return `Your phone number is ${cleanPhone}`;
        } else {
          return "I don't know your phone number. Please tell me your phone number so I can remember it.";
        }
      }
      
      if (questionLower.includes('name')) {
        // Filter for user's own name (no person specified)
        const nameData = userData
          .filter(item => item.dataType === 'name' && !item.person && !item.metadata?.person)
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0]; // Get most recent
        if (nameData) {
          const cleanName = this.extractNameFromContent(nameData.content);
          return `Your name is ${cleanName}`;
        } else {
          return "I don't know your name. Please tell me your name so I can remember it.";
        }
      }
      
      if (questionLower.includes('like') || questionLower.includes('prefer')) {
        // Filter for user's own preferences (no person specified)
        const preferences = userData.filter(item => item.dataType === 'preference' && !item.person && !item.metadata?.person);
        if (preferences.length > 0) {
          const cleanPrefs = preferences.map(p => this.extractCleanPreference(p.content));
          const prefList = cleanPrefs.join(', ');
          return `You like: ${prefList}`;
        } else {
          return "I don't know what you like. Please tell me your preferences so I can remember them.";
        }
      }
      
      if (questionLower.includes('work') || questionLower.includes('job')) {
        // Filter for user's own work (no person specified)
        const workData = userData
          .filter(item => item.dataType === 'work' && !item.person && !item.metadata?.person)
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0]; // Get most recent
        if (workData) {
          const cleanWork = this.extractCleanWork(workData.content);
          return `You work as ${cleanWork}`;
        } else {
          return "I don't know about your work. Please tell me about your job so I can remember it.";
        }
      }
      
      if (questionLower.includes('who') && questionLower.includes('you')) {
        // Filter for user's own identity (no person specified)
        const identityData = userData
          .filter(item => item.dataType === 'identity' && !item.person && !item.metadata?.person)
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)); // Get most recent first
        if (identityData.length > 0) {
          const cleanIdentity = identityData.map(i => this.extractCleanIdentity(i.content));
          const identityList = cleanIdentity.join(', ');
          return `You are: ${identityList}`;
        } else {
          return "I don't know much about you. Please tell me about yourself so I can remember.";
        }
      }
      
      // Generic search for any relevant information
      const relevantData = userData.filter(item => 
        item.content.toLowerCase().includes(questionLower.split(' ')[0]) ||
        questionLower.includes(item.dataType)
      );
      
      if (relevantData.length > 0) {
        const dataList = relevantData.map(d => d.content).join(', ');
        return `Based on what you've told me: ${dataList}`;
      }
      
      return "I don't have that information. Please tell me about it so I can remember it for you.";
      
    } catch (error) {
      console.error('❌ Error answering user question:', error);
      return "I'm having trouble accessing your information. Please try again.";
    }
  }
}

module.exports = VectorService;
