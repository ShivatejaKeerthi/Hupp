import { Candidate, AnalysisResult } from '../types';
import { mockCandidates } from '../data/mockData';
import { v4 as uuidv4 } from '../utils/uuid';
import { 
  getAllCandidates as fetchAllCandidates,
  getCandidateById as fetchCandidateById,
  getCandidateByGithubUsername,
  createCandidate as createCandidateInFirebase,
  updateCandidate as updateCandidateInFirebase,
  deleteCandidate as deleteCandidateInFirebase
} from './firebaseService';

// In-memory storage for candidates (will be populated from database)
let candidates: Candidate[] = [];

/**
 * Get all candidates
 */
export const getAllCandidates = async (): Promise<Candidate[]> => {
  try {
    // Try to fetch from Firebase
    const dbCandidates = await fetchAllCandidates();
    if (dbCandidates && dbCandidates.length > 0) {
      candidates = dbCandidates; // Update in-memory cache
      return dbCandidates;
    }
    
    // Fallback to in-memory data
    return candidates;
  } catch (error) {
    console.error('Error fetching candidates from Firebase:', error);
    // Fallback to in-memory data
    return candidates;
  }
};

/**
 * Get candidate by ID
 */
export const getCandidateById = async (id: string): Promise<Candidate | undefined> => {
  try {
    // Try to fetch from Firebase
    const dbCandidate = await fetchCandidateById(id);
    if (dbCandidate) {
      return dbCandidate;
    }
    
    // Fallback to in-memory data
    return candidates.find(candidate => candidate.id === id);
  } catch (error) {
    console.error('Error fetching candidate from Firebase:', error);
    // Fallback to in-memory data
    return candidates.find(candidate => candidate.id === id);
  }
};

/**
 * Add a new candidate from analysis result
 */
export const addCandidateFromAnalysis = async (analysisResult: AnalysisResult): Promise<Candidate> => {
  const { profile, metrics, matchScore, benchmark } = analysisResult;
  
  try {
    console.log('Adding candidate from analysis:', profile.githubUsername);
    
    // First check if candidate already exists in memory
    let existingCandidate = candidates.find(c => c.githubUsername === profile.githubUsername);
    
    // If not found in memory, try to fetch from database
    if (!existingCandidate) {
      try {
        // Try to get candidate by GitHub username
        const dbCandidate = await getCandidateByGithubUsername(profile.githubUsername);
        if (dbCandidate) {
          existingCandidate = dbCandidate;
          console.log('Found existing candidate in database:', profile.githubUsername);
        }
      } catch (error) {
        console.warn('Error checking for existing candidate in database:', error);
        // Continue with the process even if there's an error checking
      }
    }
    
    if (existingCandidate) {
      console.log('Candidate already exists, updating:', profile.githubUsername);
      
      // Update existing candidate
      const updatedCandidateData = {
        ...existingCandidate,
        matchScore,
        commitMetrics: metrics,
        position: benchmark
      };
      
      try {
        // Update in Firebase
        await updateCandidateInFirebase(existingCandidate.id, updatedCandidateData);
        console.log('Candidate updated successfully in Firebase:', profile.githubUsername);
      } catch (error) {
        console.error('Error updating candidate in Firebase:', error);
      }
      
      // Update in-memory cache
      candidates = candidates.map(c => 
        c.githubUsername === profile.githubUsername ? updatedCandidateData : c
      );
      
      return updatedCandidateData;
    } else {
      console.log('Creating new candidate:', profile.githubUsername);
      
      // Create new candidate
      const newCandidate: Candidate = {
        id: uuidv4(),
        name: profile.name || profile.githubUsername,
        email: profile.email || `${profile.githubUsername}@example.com`,
        githubUsername: profile.githubUsername,
        avatarUrl: profile.avatarUrl,
        matchScore,
        status: 'pending',
        commitMetrics: metrics,
        createdAt: new Date().toISOString(),
        position: benchmark
      };
      
      try {
        // Save to Firebase
        await createCandidateInFirebase(newCandidate);
        console.log('New candidate created successfully in Firebase:', profile.githubUsername);
      } catch (error) {
        console.error('Error creating candidate in Firebase:', error);
      }
      
      // Update in-memory cache
      candidates = [newCandidate, ...candidates];
      
      return newCandidate;
    }
  } catch (error) {
    console.error('Error in addCandidateFromAnalysis:', error);
    
    // Fallback to in-memory storage
    // Check if candidate already exists in memory
    const existingCandidate = candidates.find(c => c.githubUsername === profile.githubUsername);
    
    if (existingCandidate) {
      console.log('Candidate exists in memory, updating:', profile.githubUsername);
      
      // Update existing candidate
      const updatedCandidate = {
        ...existingCandidate,
        matchScore,
        commitMetrics: metrics,
        position: benchmark
      };
      
      // Update in-memory cache
      candidates = candidates.map(c => 
        c.githubUsername === profile.githubUsername ? updatedCandidate : c
      );
      
      return updatedCandidate;
    } else {
      console.log('Creating new candidate in memory:', profile.githubUsername);
      
      // Create new candidate
      const newCandidate: Candidate = {
        id: uuidv4(),
        name: profile.name || profile.githubUsername,
        email: profile.email || `${profile.githubUsername}@example.com`,
        githubUsername: profile.githubUsername,
        avatarUrl: profile.avatarUrl,
        matchScore,
        status: 'pending',
        commitMetrics: metrics,
        createdAt: new Date().toISOString(),
        position: benchmark
      };
      
      // Update in-memory cache
      candidates = [newCandidate, ...candidates];
      
      return newCandidate;
    }
  }
};

/**
 * Update candidate status
 */
export const updateCandidateStatus = async (
  id: string, 
  status: 'pending' | 'reviewed' | 'hired' | 'rejected'
): Promise<Candidate | undefined> => {
  try {
    console.log('Updating candidate status:', id, status);
    // Update in Firebase
    const updatedCandidate = await updateCandidateInFirebase(id, { status });
    
    // Update in-memory cache
    candidates = candidates.map(c => c.id === id ? { ...c, status } : c);
    
    return updatedCandidate || candidates.find(c => c.id === id);
  } catch (error) {
    console.error('Error updating candidate status in Firebase:', error);
    
    // Fallback to in-memory storage
    const candidate = candidates.find(c => c.id === id);
    
    if (candidate) {
      const updatedCandidate = { ...candidate, status };
      candidates = candidates.map(c => c.id === id ? updatedCandidate : c);
      return updatedCandidate;
    }
    
    return undefined;
  }
};

/**
 * Delete candidate
 */
export const deleteCandidate = async (id: string): Promise<boolean> => {
  try {
    // Delete from Firebase
    const success = await deleteCandidateInFirebase(id);
    
    // Update in-memory cache
    const initialLength = candidates.length;
    candidates = candidates.filter(c => c.id !== id);
    
    return success || candidates.length < initialLength;
  } catch (error) {
    console.error('Error deleting candidate from Firebase:', error);
    
    // Fallback to in-memory storage
    const initialLength = candidates.length;
    candidates = candidates.filter(c => c.id !== id);
    
    return candidates.length < initialLength;
  }
};

/**
 * Filter candidates
 */
export const filterCandidates = (
  candidatesList: Candidate[],
  searchTerm: string = '',
  statusFilter: string = 'all',
  positionFilter: string = 'all',
  scoreFilter: string = 'all'
): Candidate[] => {
  return candidatesList.filter(candidate => {
    // Search term filter
    const matchesSearch = 
      candidate.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      candidate.githubUsername.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Status filter
    const matchesStatus = statusFilter === 'all' || candidate.status === statusFilter;
    
    // Position filter
    const matchesPosition = positionFilter === 'all' || candidate.position === positionFilter;
    
    // Score filter
    let matchesScore = true;
    if (scoreFilter === 'high') {
      matchesScore = candidate.matchScore >= 85;
    } else if (scoreFilter === 'medium') {
      matchesScore = candidate.matchScore >= 70 && candidate.matchScore < 85;
    } else if (scoreFilter === 'low') {
      matchesScore = candidate.matchScore < 70;
    }
    
    return matchesSearch && matchesStatus && matchesPosition && matchesScore;
  });
};

/**
 * Compare two candidates
 */
export const compareCandidates = (candidate1Id: string, candidate2Id: string) => {
  const candidate1 = candidates.find(c => c.id === candidate1Id);
  const candidate2 = candidates.find(c => c.id === candidate2Id);
  
  if (!candidate1 || !candidate2) {
    return null;
  }
  
  // Calculate differences in metrics
  const comparison = {
    matchScore: {
      difference: candidate1.matchScore - candidate2.matchScore,
      winner: candidate1.matchScore > candidate2.matchScore ? candidate1.id : candidate2.id
    },
    codeQuality: {
      difference: candidate1.commitMetrics.codeQualityScore - candidate2.commitMetrics.codeQualityScore,
      winner: candidate1.commitMetrics.codeQualityScore > candidate2.commitMetrics.codeQualityScore ? candidate1.id : candidate2.id
    },
    consistency: {
      difference: candidate1.commitMetrics.consistencyScore - candidate2.commitMetrics.consistencyScore,
      winner: candidate1.commitMetrics.consistencyScore > candidate2.commitMetrics.consistencyScore ? candidate1.id : candidate2.id
    },
    collaboration: {
      difference: candidate1.commitMetrics.collaborationScore - candidate2.commitMetrics.collaborationScore,
      winner: candidate1.commitMetrics.collaborationScore > candidate2.commitMetrics.collaborationScore ? candidate1.id : candidate2.id
    },
    technicalDiversity: {
      difference: candidate1.commitMetrics.technicalDiversityScore - candidate2.commitMetrics.technicalDiversityScore,
      winner: candidate1.commitMetrics.technicalDiversityScore > candidate2.commitMetrics.technicalDiversityScore ? candidate1.id : candidate2.id
    },
    overallScore: {
      difference: candidate1.commitMetrics.overallScore - candidate2.commitMetrics.overallScore,
      winner: candidate1.commitMetrics.overallScore > candidate2.commitMetrics.overallScore ? candidate1.id : candidate2.id
    },
    totalCommits: {
      difference: candidate1.commitMetrics.totalCommits - candidate2.commitMetrics.totalCommits,
      winner: candidate1.commitMetrics.totalCommits > candidate2.commitMetrics.totalCommits ? candidate1.id : candidate2.id
    }
  };
  
  // Count wins for each candidate
  let candidate1Wins = 0;
  let candidate2Wins = 0;
  
  Object.values(comparison).forEach(metric => {
    if (metric.winner === candidate1.id) {
      candidate1Wins++;
    } else if (metric.winner === candidate2.id) {
      candidate2Wins++;
    }
  });
  
  // Determine overall winner
  const overallWinner = candidate1Wins > candidate2Wins ? candidate1 : candidate2;
  
  return {
    candidate1,
    candidate2,
    metrics: comparison,
    candidate1Wins,
    candidate2Wins,
    overallWinner
  };
};