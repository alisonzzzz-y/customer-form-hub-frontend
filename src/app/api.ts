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
  similarityScore: number | null;
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

// One ticket returned by the backend
export interface Ticket {
  id: number;
  customerName: string;
  createdBy: string | null;
  assignedTo: string | null;
  status: string;
  urgency: string | null;
  ndaStatus: string | null;
  deadline: string | null;
  businessImpact: string | null;
  eta: string | null;
  createdAt: string | null;
}

// Get all tickets
export async function getTickets(): Promise<Ticket[]> {
  const response = await api.get<Ticket[]>("/tickets");
  return response.data;
}
