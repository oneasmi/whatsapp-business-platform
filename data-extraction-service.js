const { GoogleGenerativeAI } = require('@google/generative-ai');

class DataExtractionService {
  constructor() {
    this.isAvailable = !!process.env.GEMINI_API_KEY;
    if (this.isAvailable) {
      this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    }
  }

  async extractStructuredData(messageText, userName) {
    if (!this.isAvailable) {
      return this.fallbackExtraction(messageText);
    }

    const prompt = `Extract structured data from this message: "${messageText}"

Extract the following information and return as JSON:
{
  "dataType": "birthday|phone|name|preference|work|identity|trip|event|other",
  "subject": "self|other_person_name",
  "extractedData": "clean extracted data",
  "keywords": ["key", "words", "extracted"],
  "date": "extracted date if any",
  "person": "person name if mentioned"
}

Rules:
1. If it's about the user (me/my/I), set subject: "self"
2. If it's about someone else (Adam's, John's, etc.), set subject: "other_person_name" and extract the person's name
3. Extract only the meaningful data, not the full sentence
4. For birthdays: extract just the date
5. For trips/events: extract destination and date
6. For preferences: extract the specific thing they like
7. For work: extract the job title/role
8. For names: extract just the name

Examples:
- "my birthday is on 15th sept" → {"dataType": "birthday", "subject": "self", "extractedData": "15th September", "keywords": ["birthday", "15th", "september"], "date": "15th September"}
- "Adam's birthday is on 8th august" → {"dataType": "birthday", "subject": "Adam", "extractedData": "8th August", "keywords": ["birthday", "8th", "august"], "date": "8th August", "person": "Adam"}
- "I like pineapple" → {"dataType": "preference", "subject": "self", "extractedData": "pineapple", "keywords": ["like", "pineapple"]}
- "Can you remember my next trip to the US on 18th Dec?" → {"dataType": "trip", "subject": "self", "extractedData": "trip to US on 18th December", "keywords": ["trip", "US", "18th", "december"], "date": "18th December"}
- "My name is John" → {"dataType": "name", "subject": "self", "extractedData": "John", "keywords": ["name", "john"]}

Return only the JSON object, no other text.`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const resultText = response.text().trim();
      
      // Try to parse JSON response
      try {
        const extractedData = JSON.parse(resultText);
        return extractedData;
      } catch (parseError) {
        console.log('⚠️ Failed to parse JSON, using fallback extraction');
        return this.fallbackExtraction(messageText);
      }
    } catch (error) {
      console.error('❌ Error in data extraction:', error);
      return this.fallbackExtraction(messageText);
    }
  }

  fallbackExtraction(messageText) {
    const text = messageText.toLowerCase();
    
    // Basic fallback extraction
    if (text.includes('birthday') || text.includes('born')) {
      const dateMatch = messageText.match(/(\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|may|june|july|august|september|october|november|december)[a-z]*)/i);
      const date = dateMatch ? dateMatch[1] : 'date mentioned';
      
      // Check if it's about someone else
      const otherPersonMatch = messageText.match(/(\w+)'s\s+birthday/i);
      if (otherPersonMatch) {
        return {
          dataType: 'birthday',
          subject: otherPersonMatch[1],
          extractedData: date,
          keywords: ['birthday', date.toLowerCase()],
          date: date,
          person: otherPersonMatch[1]
        };
      }
      
      return {
        dataType: 'birthday',
        subject: 'self',
        extractedData: date,
        keywords: ['birthday', date.toLowerCase()],
        date: date
      };
    }
    
    if (text.includes('phone') || text.includes('number')) {
      const phoneMatch = messageText.match(/(\d{10,15})/);
      const phone = phoneMatch ? phoneMatch[1] : 'phone number mentioned';
      
      return {
        dataType: 'phone',
        subject: 'self',
        extractedData: phone,
        keywords: ['phone', 'number'],
        date: null
      };
    }
    
    if (text.includes('name is') || text.includes('i am') || text.includes('i\'m')) {
      const nameMatch = messageText.match(/(?:name is|i am|i'm)\s+([a-zA-Z\s]+)/i);
      const name = nameMatch ? nameMatch[1].trim() : 'name mentioned';
      
      return {
        dataType: 'name',
        subject: 'self',
        extractedData: name,
        keywords: ['name'],
        date: null
      };
    }
    
    if (text.includes('like') || text.includes('love')) {
      const likeMatch = messageText.match(/(?:like|love)\s+([^.!?]+)/i);
      const preference = likeMatch ? likeMatch[1].trim() : 'preference mentioned';
      
      return {
        dataType: 'preference',
        subject: 'self',
        extractedData: preference,
        keywords: ['like', 'love'],
        date: null
      };
    }
    
    if (text.includes('work') || text.includes('job') || (text.includes('i am') && !text.includes('a ') && !text.includes('an ')) || (text.includes('i\'m') && !text.includes('a ') && !text.includes('an '))) {
      // Check if it's about work/profession
      const workMatch = messageText.match(/(?:work|job).*?as\s+([^.!?]+)|i\s+(?:am|'m)\s+a\s+([^.!?]+)|i\s+(?:am|'m)\s+an\s+([^.!?]+)/i);
      let work = 'work mentioned';
      
      if (workMatch) {
        work = workMatch[1] || workMatch[2] || workMatch[3];
        work = work.trim();
      }
      
      return {
        dataType: 'work',
        subject: 'self',
        extractedData: work,
        keywords: ['work', 'job'],
        date: null
      };
    }
    
    if (text.includes('trip') || text.includes('travel')) {
      const tripMatch = messageText.match(/(?:trip|travel).*?to\s+([^.!?]+)/i);
      const destination = tripMatch ? tripMatch[1].trim() : 'trip mentioned';
      
      return {
        dataType: 'trip',
        subject: 'self',
        extractedData: destination,
        keywords: ['trip', 'travel'],
        date: null
      };
    }
    
    return {
      dataType: 'other',
      subject: 'self',
      extractedData: messageText,
      keywords: [],
      date: null
    };
  }

  generateStorageKey(phoneNumber, dataType, subject, person = null) {
    if (subject === 'self') {
      return `${phoneNumber}_${dataType}`;
    } else {
      return `${phoneNumber}_${dataType}_${person || subject}`;
    }
  }

  generateResponseMessage(extractedData, userName) {
    const { dataType, subject, extractedData: data, person } = extractedData;
    
    if (subject === 'self') {
      switch (dataType) {
        case 'birthday':
          return `gotcha, your birthday is ${data}`;
        case 'phone':
          return `gotcha, your phone number is ${data}`;
        case 'name':
          return `gotcha, your name is ${data}`;
        case 'preference':
          return `gotcha, you like ${data}`;
        case 'trip':
          return `gotcha, your trip is ${data}`;
        case 'work':
          return `gotcha, you work as ${data}`;
        default:
          return `gotcha, ${data}`;
      }
    } else {
      const personName = person || subject;
      switch (dataType) {
        case 'birthday':
          return `gotcha, ${personName}'s birthday is ${data}`;
        case 'phone':
          return `gotcha, ${personName}'s phone number is ${data}`;
        case 'name':
          return `gotcha, ${personName}'s name is ${data}`;
        case 'preference':
          return `gotcha, ${personName} likes ${data}`;
        default:
          return `gotcha, ${personName}'s ${dataType} is ${data}`;
      }
    }
  }
}

module.exports = DataExtractionService;
