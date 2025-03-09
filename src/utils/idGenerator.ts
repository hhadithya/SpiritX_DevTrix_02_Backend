import { firestore } from '../firebase/firebase';

/**
 * Generates the next sequential ID using a counter document
 * @param collectionPath Path to the collection (e.g., 'players')
 * @returns The next ID in sequence as a 4-digit string
 */
export const generateNextId = async (collectionPath: string): Promise<string> => {
  try {
    // Reference to the counters collection
    const counterRef = firestore.collection('counters').doc(collectionPath);
    
    // Use a transaction to safely increment the counter
    const nextId = await firestore.runTransaction(async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      
      let currentCount = 1;
      if (counterDoc.exists) {
        currentCount = counterDoc.data()?.count + 1 || 1;
      }
      
      // Update the counter
      transaction.set(counterRef, { count: currentCount });
      
      // Return the formatted ID
      return currentCount.toString().padStart(4, '0');
    });
    
    return nextId;
  } catch (error) {
    console.error('Error generating next ID:', error);
    throw error;
  }
};