// API helper for talking to the Spring Boot backend
import axios from "axios";

// One search result chunk returned by the backend
export interface SearchResult {
  id: number;
  documentTitle: string;
  sectionTitle: string;
  content: string;
  source: string;
  lastUpdated: string;
  sharingStatus: string;
  department: string;
  approved: boolean;
}

// Axios instance with the backend base URL
const api = axios.create({
  baseURL: "http://localhost:8080/api",
});

// Search the knowledge base for the top relevant chunks for a question
export async function searchKnowledgeBase(
  question: string,
): Promise<SearchResult[]> {
  const response = await api.post<SearchResult[]>("/knowledge-base/search", {
    question,
  });
  return response.data;
}
