import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import {
  getDatabase,
  ref,
  set,
  get,
  update,
  remove,
  query,
  orderByChild,
  equalTo,
  onValue,
  push,
  child
} from 'firebase/database';
import { Candidate, Job, User } from '../types';
import { mockCandidates, mockJobs } from '../data/mockData';
import { v4 as uuidv4 } from '../utils/uuid';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyByFR76HMTNTGnIbLtgAKSY48OIWytTY4s",
  authDomain: "huppforgithub.firebaseapp.com",
  databaseURL: "https://huppforgithub-default-rtdb.firebaseio.com",
  projectId: "huppforgithub",
  storageBucket: "huppforgithub.firebasestorage.app",
  messagingSenderId: "837877010419",
  appId: "1:837877010419:web:f918249199afc330a20c86",
  measurementId: "G-4WP21QYB3C"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// Flag to track initialization status
let isInitialized = false;
// Flag to track if we're using mock data due to offline mode
let usingMockData = false;

// Initialize database with mock data
export const initializeDatabase = async (mockCandidates: Candidate[], mockJobs: Job[]): Promise<boolean> => {
  try {
    if (isInitialized) {
      return true;
    }

    console.log('Initializing Firebase Realtime Database...');

    try {
      // Check if we can connect to Firebase
      const testRef = ref(db, 'test/connectivity');
      await set(testRef, { timestamp: new Date().toISOString() });
      console.log('Firebase connection test: successful');
    } catch (error) {
      console.warn('Firebase connectivity issue detected, using mock data:', error);
      usingMockData = true;
      isInitialized = true;
      return true; // Return success but use mock data
    }

    if (!usingMockData) {
      try {
        // Create admin user in Firebase Authentication
        try {
          const adminCredential = await createUserWithEmailAndPassword(auth, 'admin@hupp.com', 'admin123');
          console.log('Admin user created in Auth');
          
          // Create admin user in Realtime Database
          const adminRef = ref(db, `users/${adminCredential.user.uid}`);
          await set(adminRef, {
            id: adminCredential.user.uid,
            name: 'Admin User',
            email: 'admin@hupp.com',
            role: 'admin',
            createdAt: new Date().toISOString()
          });
          console.log('Admin user created in Realtime Database');
        } catch (error: any) {
          // If user already exists in Auth, try to find it
          if (error.code === 'auth/email-already-in-use') {
            console.log('Admin user already exists in Auth');
            
            // Try to find admin user in Realtime Database
            const usersRef = ref(db, 'users');
            const adminQuery = query(usersRef, orderByChild('email'), equalTo('admin@hupp.com'));
            const snapshot = await get(adminQuery);
            
            if (!snapshot.exists()) {
              // Admin exists in Auth but not in Realtime Database
              console.log('Admin user not found in Realtime Database, creating...');
              
              try {
                // Sign in as admin to get UID
                const adminCredential = await signInWithEmailAndPassword(auth, 'admin@hupp.com', 'admin123');
                
                // Create admin user in Realtime Database
                const adminRef = ref(db, `users/${adminCredential.user.uid}`);
                await set(adminRef, {
                  id: adminCredential.user.uid,
                  name: 'Admin User',
                  email: 'admin@hupp.com',
                  role: 'admin',
                  createdAt: new Date().toISOString()
                });
                console.log('Admin user created in Realtime Database');
              } catch (signInError) {
                console.error('Error signing in as admin:', signInError);
              }
            } else {
              console.log('Admin user already exists in Realtime Database');
            }
          } else {
            console.error('Error creating admin user:', error);
          }
        }
        
        // Check if candidates exist
        const candidatesRef = ref(db, 'candidates');
        const candidatesSnapshot = await get(candidatesRef);
        
        if (!candidatesSnapshot.exists()) {
          console.log('Candidates not found, adding mock data...');
          // Insert mock candidates
          for (const candidate of mockCandidates) {
            try {
              await set(ref(db, `candidates/${candidate.id}`), {
                ...candidate,
                createdAt: candidate.createdAt || new Date().toISOString()
              });
            } catch (err) {
              console.error(`Error inserting candidate ${candidate.name}:`, err);
            }
          }
          console.log('Mock candidates inserted');
        } else {
          console.log('Candidates already exist in Realtime Database');
        }
        
        // Check if jobs exist
        const jobsRef = ref(db, 'jobs');
        const jobsSnapshot = await get(jobsRef);
        
        if (!jobsSnapshot.exists()) {
          console.log('Jobs not found, adding mock data...');
          // Insert mock jobs
          for (const job of mockJobs) {
            try {
              await set(ref(db, `jobs/${job.id}`), {
                ...job,
                createdAt: new Date().toISOString()
              });
            } catch (err) {
              console.error(`Error inserting job ${job.title}:`, err);
            }
          }
          console.log('Mock jobs inserted');
        } else {
          console.log('Jobs already exist in Realtime Database');
        }
      } catch (error) {
        console.warn('Error during Firebase initialization, falling back to mock data:', error);
        usingMockData = true;
      }
    }
    
    isInitialized = true;
    return true;
  } catch (error) {
    console.error('Database initialization error:', error);
    usingMockData = true;
    isInitialized = true;
    return true; // Return success but use mock data
  }
};

// Auth operations
export const registerUser = async (email: string, password: string, name: string, role: string = 'recruiter'): Promise<User | null> => {
  try {
    if (usingMockData) {
      // Mock user registration
      return {
        id: uuidv4(),
        name,
        email,
        role: role as 'admin' | 'recruiter' | 'hiring_manager',
        createdAt: new Date().toISOString()
      };
    }

    // Create user in Firebase Authentication
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;
    
    // Create user document in Realtime Database
    const userData: User = {
      id: firebaseUser.uid,
      name,
      email,
      role: role as 'admin' | 'recruiter' | 'hiring_manager',
      createdAt: new Date().toISOString()
    };
    
    await set(ref(db, `users/${firebaseUser.uid}`), userData);
    
    return userData;
  } catch (error) {
    console.error('Error registering user:', error);
    
    if (usingMockData) {
      // Mock user registration
      return {
        id: uuidv4(),
        name,
        email,
        role: role as 'admin' | 'recruiter' | 'hiring_manager',
        createdAt: new Date().toISOString()
      };
    }
    
    return null;
  }
};

export const loginUser = async (email: string, password: string): Promise<User | null> => {
  try {
    if (usingMockData) {
      // Mock user login
      if (email === 'keerthishivateja@gmail.com' && password === 'hupp@github') {
        localStorage.setItem('token', 'mock-token');
        return {
          id: 'admin-id',
          name: 'Admin User',
          email: 'keerthishivateja@gmail.com',
          role: 'admin',
          createdAt: new Date().toISOString()
        };
      }
      return null;
    }

    // Sign in with Firebase Authentication
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;
    
    // Get user data from Realtime Database
    const userRef = ref(db, `users/${firebaseUser.uid}`);
    const snapshot = await get(userRef);
    
    if (snapshot.exists()) {
      // Store token in localStorage
      const token = await firebaseUser.getIdToken();
      localStorage.setItem('token', token);
      return { id: firebaseUser.uid, ...snapshot.val() } as User;
    } else {
      // User exists in Auth but not in Realtime Database, create it
      const userData: User = {
        id: firebaseUser.uid,
        name: email.split('@')[0],
        email: email,
        role: 'admin',
        createdAt: new Date().toISOString()
      };
      
      await set(userRef, userData);
      const token = await firebaseUser.getIdToken();
      localStorage.setItem('token', token);
      return userData;
    }
  } catch (error) {
    console.error('Error logging in:', error);
    
    if (usingMockData && email === 'keerthishivateja@gmail.com' && password === 'hupp@github') {
      // Mock admin login
      localStorage.setItem('token', 'mock-token');
      return {
        id: 'admin-id',
        name: 'Admin User',
        email: 'keerthishivateja@gmail.com',
        role: 'admin',
        createdAt: new Date().toISOString()
      };
    }
    
    return null;
  }
};

export const logoutUser = async (): Promise<boolean> => {
  try {
    if (!usingMockData) {
      await signOut(auth);
    }
    localStorage.removeItem('token');
    return true;
  } catch (error) {
    console.error('Error logging out:', error);
    return false;
  }
};

export const getCurrentUser = (): Promise<User | null> => {
  return new Promise((resolve) => {
    if (usingMockData) {
      // Check if we have a token in localStorage
      const token = localStorage.getItem('token');
      if (token) {
        resolve({
          id: 'admin-id',
          name: 'Admin User',
          email: 'keerthishivateja@gmail.com',
          role: 'admin',
          createdAt: new Date().toISOString()
        });
      } else {
        resolve(null);
      }
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      unsubscribe();
      
      if (firebaseUser) {
        try {
          // Get user data from Realtime Database
          const userRef = ref(db, `users/${firebaseUser.uid}`);
          const snapshot = await get(userRef);
          
          if (snapshot.exists()) {
            resolve({ id: firebaseUser.uid, ...snapshot.val() } as User);
          } else {
            // User exists in Auth but not in Realtime Database, create it
            const userData: User = {
              id: firebaseUser.uid,
              name: firebaseUser.email?.split('@')[0] || 'User',
              email: firebaseUser.email || '',
              role: 'admin',
              createdAt: new Date().toISOString()
            };
            
            await set(userRef, userData);
            resolve(userData);
          }
        } catch (error) {
          console.error('Error getting current user data:', error);
          resolve(null);
        }
      } else {
        resolve(null);
      }
    });
  });
};

// Candidate operations with real-time updates
let candidatesUnsubscribe: (() => void) | null = null;

export const subscribeToAllCandidates = (callback: (candidates: Candidate[]) => void): () => void => {
  if (usingMockData) {
    // If using mock data, just call the callback once with mock data
    callback(mockCandidates);
    return () => {}; // Return empty unsubscribe function
  }

  try {
    // Unsubscribe from previous listener if exists
    if (candidatesUnsubscribe) {
      candidatesUnsubscribe();
    }

    const candidatesRef = ref(db, 'candidates');
    
    // Set up real-time listener
    const unsubscribe = onValue(candidatesRef, (snapshot) => {
      if (snapshot.exists()) {
        const candidatesData = snapshot.val();
        const candidates = Object.values(candidatesData) as Candidate[];
        console.log(`Real-time update: Retrieved ${candidates.length} candidates from Realtime Database`);
        callback(candidates);
      } else {
        console.log('No candidates found in Realtime Database, using mock data');
        callback(mockCandidates);
      }
    }, (error) => {
      console.error('Error in candidates real-time listener:', error);
      callback(mockCandidates); // Fallback to mock data on error
    });
    
    candidatesUnsubscribe = unsubscribe;
    return unsubscribe;
  } catch (error) {
    console.error('Error setting up candidates subscription:', error);
    callback(mockCandidates); // Fallback to mock data
    return () => {}; // Return empty unsubscribe function
  }
};

export const getAllCandidates = async (): Promise<Candidate[]> => {
  try {
    if (usingMockData) {
      return mockCandidates;
    }

    const candidatesRef = ref(db, 'candidates');
    const snapshot = await get(candidatesRef);
    
    if (snapshot.exists()) {
      const candidatesData = snapshot.val();
      const candidates = Object.values(candidatesData) as Candidate[];
      console.log(`Retrieved ${candidates.length} candidates from Realtime Database`);
      return candidates;
    }
    
    console.log('No candidates found in Realtime Database, using mock data');
    return mockCandidates;
  } catch (error) {
    console.error('Error getting all candidates:', error);
    return mockCandidates;
  }
};

export const getCandidateById = async (id: string): Promise<Candidate | null> => {
  try {
    if (usingMockData) {
      return mockCandidates.find(c => c.id === id) || null;
    }

    const candidateRef = ref(db, `candidates/${id}`);
    const snapshot = await get(candidateRef);
    
    if (snapshot.exists()) {
      return snapshot.val() as Candidate;
    }
    
    // Fallback to mock data
    return mockCandidates.find(c => c.id === id) || null;
  } catch (error) {
    console.error('Error getting candidate by id:', error);
    return mockCandidates.find(c => c.id === id) || null;
  }
};

export const getCandidateByGithubUsername = async (githubUsername: string): Promise<Candidate | null> => {
  try {
    if (usingMockData) {
      return mockCandidates.find(c => c.githubUsername === githubUsername) || null;
    }

    console.log('Searching for candidate with GitHub username:', githubUsername);
    
    // Instead of using a query with orderByChild, we'll get all candidates and filter manually
    // This avoids the need for an index on githubUsername
    const candidatesRef = ref(db, 'candidates');
    const snapshot = await get(candidatesRef);
    
    if (snapshot.exists()) {
      const candidatesData = snapshot.val();
      const candidates = Object.values(candidatesData) as Candidate[];
      
      // Find the candidate with matching GitHub username
      const matchingCandidate = candidates.find(c => c.githubUsername === githubUsername);
      
      if (matchingCandidate) {
        console.log('Found candidate with GitHub username:', githubUsername);
        return matchingCandidate;
      }
    }
    
    console.log('No candidate found with GitHub username:', githubUsername);
    return null;
  } catch (error) {
    console.error('Error getting candidate by github username:', error);
    return null;
  }
};

export const createCandidate = async (candidateData: Candidate): Promise<Candidate> => {
  try {
    if (usingMockData) {
      console.log('Using mock data, not saving candidate to Realtime Database');
      return candidateData;
    }

    console.log('Creating candidate in Realtime Database:', candidateData.name);
    await set(ref(db, `candidates/${candidateData.id}`), {
      ...candidateData,
      createdAt: candidateData.createdAt || new Date().toISOString()
    });
    
    console.log('Candidate created successfully:', candidateData.name);
    return candidateData;
  } catch (error) {
    console.error('Error creating candidate:', error);
    return candidateData;
  }
};

export const updateCandidate = async (id: string, candidateData: Partial<Candidate>): Promise<Candidate | null> => {
  try {
    if (usingMockData) {
      // Find the candidate in mock data
      const candidate = mockCandidates.find(c => c.id === id);
      if (candidate) {
        return { ...candidate, ...candidateData };
      }
      return null;
    }

    console.log('Updating candidate in Realtime Database:', id);
    const candidateRef = ref(db, `candidates/${id}`);
    
    // First check if the document exists
    const snapshot = await get(candidateRef);
    if (!snapshot.exists()) {
      console.error('Candidate not found in Realtime Database:', id);
      return null;
    }
    
    // Update the document
    await update(candidateRef, candidateData);
    
    // Get updated candidate
    const updatedSnapshot = await get(candidateRef);
    
    if (updatedSnapshot.exists()) {
      console.log('Candidate updated successfully:', id);
      return updatedSnapshot.val() as Candidate;
    }
    
    return null;
  } catch (error) {
    console.error('Error updating candidate:', error);
    
    // Fallback to mock data
    const candidate = mockCandidates.find(c => c.id === id);
    if (candidate) {
      return { ...candidate, ...candidateData };
    }
    
    return null;
  }
};

export const deleteCandidate = async (id: string): Promise<boolean> => {
  try {
    if (usingMockData) {
      return true;
    }

    await remove(ref(db, `candidates/${id}`));
    return true;
  } catch (error) {
    console.error('Error deleting candidate:', error);
    return false;
  }
};

// Job operations with real-time updates
let jobsUnsubscribe: (() => void) | null = null;

export const subscribeToAllJobs = (callback: (jobs: Job[]) => void): () => void => {
  if (usingMockData) {
    // If using mock data, just call the callback once with mock data
    callback(mockJobs);
    return () => {}; // Return empty unsubscribe function
  }

  try {
    // Unsubscribe from previous listener if exists
    if (jobsUnsubscribe) {
      jobsUnsubscribe();
    }

    const jobsRef = ref(db, 'jobs');
    
    // Set up real-time listener
    const unsubscribe = onValue(jobsRef, (snapshot) => {
      if (snapshot.exists()) {
        const jobsData = snapshot.val();
        const jobs = Object.values(jobsData) as Job[];
        console.log(`Real-time update: Retrieved ${jobs.length} jobs from Realtime Database`);
        callback(jobs);
      } else {
        console.log('No jobs found in Realtime Database, using mock data');
        callback(mockJobs);
      }
    }, (error) => {
      console.error('Error in jobs real-time listener:', error);
      callback(mockJobs); // Fallback to mock data on error
    });
    
    jobsUnsubscribe = unsubscribe;
    return unsubscribe;
  } catch (error) {
    console.error('Error setting up jobs subscription:', error);
    callback(mockJobs); // Fallback to mock data
    return () => {}; // Return empty unsubscribe function
  }
};

export const getAllJobs = async (): Promise<Job[]> => {
  try {
    if (usingMockData) {
      return mockJobs;
    }

    const jobsRef = ref(db, 'jobs');
    const snapshot = await get(jobsRef);
    
    if (snapshot.exists()) {
      const jobsData = snapshot.val();
      const jobs = Object.values(jobsData) as Job[];
      return jobs;
    }
    
    return mockJobs;
  } catch (error) {
    console.error('Error getting all jobs:', error);
    return mockJobs;
  }
};

export const getJobById = async (id: string): Promise<Job | null> => {
  try {
    if (usingMockData) {
      return mockJobs.find(j => j.id === id) || null;
    }

    const jobRef = ref(db, `jobs/${id}`);
    const snapshot = await get(jobRef);
    
    if (snapshot.exists()) {
      return snapshot.val() as Job;
    }
    
    // Fallback to mock data
    return mockJobs.find(j => j.id === id) || null;
  } catch (error) {
    console.error('Error getting job by id:', error);
    return mockJobs.find(j => j.id === id) || null;
  }
};

export const createJob = async (jobData: Job): Promise<Job> => {
  try {
    if (usingMockData) {
      return jobData;
    }

    await set(ref(db, `jobs/${jobData.id}`), {
      ...jobData,
      createdAt: new Date().toISOString()
    });
    
    return jobData;
  } catch (error) {
    console.error('Error creating job:', error);
    return jobData;
  }
};

export const updateJob = async (id: string, jobData: Partial<Job>): Promise<Job | null> => {
  try {
    if (usingMockData) {
      // Find the job in mock data
      const job = mockJobs.find(j => j.id === id);
      if (job) {
        return { ...job, ...jobData };
      }
      return null;
    }

    const jobRef = ref(db, `jobs/${id}`);
    await update(jobRef, jobData);
    
    // Get updated job
    const updatedSnapshot = await get(jobRef);
    
    if (updatedSnapshot.exists()) {
      return updatedSnapshot.val() as Job;
    }
    
    return null;
  } catch (error) {
    console.error('Error updating job:', error);
    
    // Fallback to mock data
    const job = mockJobs.find(j => j.id === id);
    if (job) {
      return { ...job, ...jobData };
    }
    
    return null;
  }
};

export const deleteJob = async (id: string): Promise<boolean> => {
  try {
    if (usingMockData) {
      return true;
    }

    await remove(ref(db, `jobs/${id}`));
    return true;
  } catch (error) {
    console.error('Error deleting job:', error);
    return false;
  }
};