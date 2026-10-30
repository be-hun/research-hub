import type { Project } from "./types";

// Sample data from the Stitch prototype. Replaced by the backend API.
export const MOCK_PROJECTS: Project[] = [
  {
    id: "p-001",
    title: "Multimodal Deep Learning for Early Cardiac Ischemia Detection in Underserved Patient Cohorts",
    summary:
      "Developing non-invasive convolutional sequence architectures synthesizing real-time 12-lead ECG telemetric data and historical social vulnerability indexes to forecast acute coronary syndromes.",
    colleges: ["medicine", "engineering"],
    verification: "faculty-confirmed",
    pi: { name: "Dr. Robert Keller", department: "Dept. of Bioengineering" },
    funder: "NIH R01",
    startYear: 2024,
    endYear: 2028,
    source: { label: "NIH RePORTER", url: "#" },
    updatedAt: "2025-02-14",
    match: {
      reason:
        "Matches clinical cardiology records with convolutional neural network signal processing models from Bioengineering.",
      evidence: ["NIH RePORTER Abstract", "Faculty Claimed Topic"],
    },
  },
  {
    id: "p-002",
    title: "Federated Machine Learning for Privacy-Preserving EHR Aggregation in Urban Community Clinics",
    summary:
      "Architecting decentralized learning pipelines across multi-tenant clinical electronic health records to benchmark maternal health outcomes without cross-boundary raw patient data leakage.",
    colleges: ["public-health", "science-tech"],
    verification: "public-award-record",
    pi: { name: "Dr. Ananya Sen", department: "Epidemiology & Biostatistics" },
    funder: "NSF Smart & Connected Health",
    startYear: 2023,
    endYear: 2027,
    source: { label: "NSF Awards", url: "#" },
    updatedAt: "2025-01-28",
  },
  {
    id: "p-003",
    title: "Explainable Transformer Architectures for Diagnostic Pathology of Rare Glioblastoma Subtypes",
    summary:
      "Implementing vision transformers with attention attribution heatmaps to assist neuropathologists in classifying rare oncological tissue biopsies with verifiable evidentiary trails.",
    colleges: ["science-tech", "medicine"],
    verification: "faculty-confirmed",
    pi: { name: "Dr. Michael Vance", department: "Dept. of Computer & Information Sciences" },
    funder: "NIH NCI R21",
    startYear: 2024,
    endYear: 2026,
    source: { label: "NIH RePORTER", url: "#" },
    updatedAt: "2025-02-02",
    match: {
      reason:
        'High semantic correspondence between prompt query "AI and healthcare" with digital histopathology and neural attention models.',
      evidence: ["PubMed Central DOI", "Temple Neural Computing Lab"],
    },
  },
  {
    id: "p-004",
    title: "Algorithmic Governance and Risk Mitigation in Generative Clinical Decision Support Deployment",
    summary:
      "Empirical investigation into health system operational readiness, liability distributions, and workforce adaptation metrics following large language model introduction in ambulatory care.",
    colleges: ["business", "public-health"],
    verification: "public-award-record",
    pi: { name: "Dr. Christine Morales", department: "Management Information Systems" },
    funder: "Temple Faculty Research Award",
    startYear: 2023,
    endYear: 2025,
    source: { label: "TUScholarShare", url: "#" },
    updatedAt: "2024-12-19",
  },
  {
    id: "p-005",
    title: "Adaptive Reinforcement Learning in Micro-Robotic Nanoparticle Delivery for Targeted Glioblastoma Therapeutics",
    summary:
      "Developing autonomous bio-mimetic swarm robotics driven by edge neural models to navigate interstitial cerebral fluid barriers for micro-targeted oncologic drug dispersal.",
    colleges: ["engineering", "medicine"],
    verification: "faculty-confirmed",
    pi: { name: "Dr. Julian Chen", department: "Mechanical Engineering" },
    funder: "NSF Directorate for Engineering",
    startYear: 2024,
    endYear: 2028,
    source: { label: "NSF Awards", url: "#" },
    updatedAt: "2025-02-11",
  },
];
