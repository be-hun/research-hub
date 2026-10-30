import type { CollaboratorMatch, Opportunity, Project, ProjectDetail, ResearcherProfile } from "./types";

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

export const MOCK_PROJECT_DETAILS: Record<string, ProjectDetail> = {
  "p-006": {
    id: "p-006",
    title: "AI for Health Equity: Machine Learning Detection of Disparities in Emergency Clinical Triage",
    summary:
      "A cross-institutional prospective trial deploying fair algorithmic auditing to detect, mitigate, and continuously benchmark demographic discrepancies in triage emergency severity indexes across urban healthcare environments.",
    colleges: ["medicine", "public-health", "science-tech"],
    verification: "faculty-confirmed",
    pi: { name: "Dr. Elena Rostova", department: "Department of Emergency Medicine" },
    funder: "NIH (NIMHD) R01",
    startYear: 2024,
    endYear: 2029,
    source: { label: "NIH RePORTER", url: "https://reporter.nih.gov" },
    updatedAt: "2025-02-12",
    abstract: [
      "Emergency department triage decision-making relies critically on standardized Emergency Severity Index (ESI) protocols. However, retrospective analyses of large-scale electronic health records (EHR) show systematic under-triage for vulnerable, low-income, and minority patient cohorts displaying atypical symptomatic presentations in high-volume metropolitan centers.",
      "This award brings together computational scientists, epidemiologists, and emergency clinicians to audit historical and real-time triage scoring for algorithmic disparity propagation, and to prospectively validate a transparent, counterfactual-fairness machine learning model integrated within Temple University Hospital's EHR infrastructure.",
    ],
    methodologies: [
      "Natural Language Processing",
      "EHR Telemetry",
      "Disparity Auditing",
      "Emergency Medicine",
      "Fair-ML (Algorithmic Justice)",
      "Prospective Clinical Trials",
    ],
    funding: {
      agency: "NIH (NIMHD)",
      mechanism: "R01",
      period: "2024 – 2029",
      total: "$1,850,000",
      awardNumber: "1R01MD019842-01A1",
    },
    team: [
      { researcherId: "r-rostova", name: "Dr. Elena Rostova, MD, PhD", role: "Principal Investigator", department: "Department of Emergency Medicine", college: "medicine" },
      { researcherId: "r-vance", name: "Dr. Marcus Vance, PhD", role: "Co-Principal Investigator", department: "Health Services Administration & Policy", college: "public-health" },
      { researcherId: "r-thorne", name: "Dr. Aris Thorne, PhD", role: "Co-Investigator, ML Lead", department: "Computer & Information Sciences", college: "science-tech" },
    ],
    students: {
      skills: ["Python / PyTorch", "MIMIC-IV / OMOP CDM", "Clinical NLP", "Biostatistics"],
      notice: "Currently accepting applications for Fall 2025 PhD rotations and undergraduate CARAS fellowships.",
    },
    relatedProjectIds: ["p-002", "p-001", "p-004"],
  },
};

export const MOCK_RESEARCHERS: Record<string, ResearcherProfile> = {
  "r-rivera": {
    id: "r-rivera",
    name: "Dr. Ana Rivera, PhD",
    initials: "AR",
    title: "Associate Professor of Epidemiology and Biostatistics",
    college: "public-health",
    department: "Epidemiology and Biostatistics",
    verified: true,
    orcid: "0000-0002-4819-2041",
    summary:
      "Dr. Rivera synthesizes high-dimensional electronic health records (EHR) and urban health disparities epidemiology with machine learning fairness metrics across Philadelphia community clinics, auditing algorithmic bias in public health deployments.",
    focus: ["Maternal Health Inequities", "EHR Telemetry", "Algorithmic Disparity Auditing", "Clinical Biostatistics", "GIS"],
    about:
      "Dr. Rivera directs the Health Inequities & Computational Epidemiology Lab at Temple University. Her laboratory conducts cross-disciplinary research at the intersection of quantitative biostatistics, algorithmic justice, and community-partnered public health.",
    projectIds: ["p-002", "p-006"],
    publications: [
      {
        title: "Disparities in Sepsis Onset Prediction: Assessing Fairness Frontiers Across High-Density Urban Electronic Records",
        authors: "Rivera, A., Thorne, A., Rostova, E., & Alvarez, M.",
        venue: "Journal of Medical Internet Research",
        year: 2024,
        doi: "10.2196/51240",
      },
      {
        title: "Counterfactual Bias Mitigation in Perinatal Emergency Triage: A Multicenter Community Cohort Evaluation",
        authors: "Patel, S. K., Rivera, A., & Rostova, E.",
        venue: "American Journal of Public Health",
        year: 2023,
        doi: "10.2105/AJPH.2023.307331",
      },
    ],
    accepting:
      "Accepting 1–2 Ph.D. students in Epidemiology for Fall 2025 and undergraduate CARAS research fellows for Summer 2025. Background in R, Python, or SQL preferred.",
  },
};

export const MOCK_MATCHES: CollaboratorMatch[] = [
  {
    researcherId: "r-thorne",
    name: "Dr. Aris Thorne, PhD",
    initials: "AT",
    college: "science-tech",
    title: "Associate Professor, Computer & Information Sciences",
    score: 96,
    reasons: [
      "Develops machine learning fairness auditing frameworks directly applicable to your EHR clinical triage datasets.",
      "Co-PI eligible for upcoming NIH NIMHD algorithmic disparity program announcements.",
    ],
    citations: ["NIH R01MD019842 Co-author", "JMIR 2024 (doi:10.2196/49102)"],
    sharedTopics: ["Algorithmic Auditing", "EHR Triage Telemetry", "Clinical Biostatistics"],
  },
  {
    researcherId: "r-rostova",
    name: "Dr. Elena Rostova, MD, PhD",
    initials: "ER",
    college: "medicine",
    title: "Associate Professor, Emergency Medicine & Center for Bioethics",
    score: 92,
    reasons: [
      "Oversees clinical acute triage telemetry at Temple University Hospital emergency department.",
      "Co-investigator on an emergency department health equity trial.",
    ],
    citations: ["NIH RePORTER #R01MD019842", "TUH IRB Registry"],
    sharedTopics: ["Emergency Triage", "Clinical Trials", "Health Disparities"],
  },
  {
    researcherId: "r-chen",
    name: "Dr. Julian Chen, PhD",
    initials: "JC",
    college: "business",
    title: "Professor, Healthcare Management & Applied Econometrics",
    score: 88,
    reasons: [
      "Researches institutional hospital capacity costs and econometrics of algorithmic triage delays.",
      "Seeking a biostatistical modeling partner for a health financing proposal.",
    ],
    citations: ["TUScholarShare Record #2023-88", "RWJF Grant Pipeline"],
    sharedTopics: ["Healthcare Economics", "Clinical Operations", "Health Policy"],
  },
  {
    researcherId: "r-nair",
    name: "Dr. Priya Nair, PhD",
    initials: "PN",
    college: "science-tech",
    title: "Assistant Professor, Statistics & Data Science",
    score: 85,
    reasons: [
      "Expert in causal inference methods for high-dimensional observational EHR cohorts.",
      "Recent NSF CAREER submission focuses on propensity scoring in health disparity registries.",
    ],
    citations: ["NSF DMS Award #220914", "Biometrika 2024"],
    sharedTopics: ["Causal Inference", "EHR Analytics", "Propensity Scoring"],
  },
];

export const MOCK_OPPORTUNITIES: Opportunity[] = [
  {
    id: "o-001",
    title: "Undergraduate Research Assistant – Health Informatics & EHR Pipeline",
    type: "research-assistant",
    lab: "Rivera Biostatistics Lab",
    sponsor: "Dr. Ana Rivera, PhD",
    projectId: "p-006",
    colleges: ["public-health", "medicine"],
    description:
      "Assist with automated cohort extraction from de-identified EHR databases, data quality audits, and statistical validation under direct mentorship.",
    skills: ["Python", "SQL", "Healthcare Terminology", "Pandas", "HIPAA"],
    levels: ["undergraduate"],
    paid: true,
    hourlyRate: 18.5,
    hoursPerWeek: "10–15",
    term: "Spring 2025",
    deadline: "2025-02-15",
    verifiedByPI: true,
  },
  {
    id: "o-002",
    title: "Undergraduate Informatics Fellow – Clinical Triage Optimization",
    type: "fellowship",
    lab: "Center for Health Disparities & Medical Computing",
    sponsor: "Dr. Elena Rostova, MD, PhD",
    colleges: ["medicine", "business"],
    description: "Funded fellowship supporting Epic EHR telemetry analysis. CARAS eligible; work-study available.",
    skills: ["SQL", "Data Science", "Database Management"],
    levels: ["undergraduate"],
    paid: true,
    hourlyRate: 18.5,
    hoursPerWeek: "8–10",
    term: "Summer & Fall 2025",
    deadline: "2025-03-30",
    verifiedByPI: true,
  },
  {
    id: "o-003",
    title: "Research Assistant – Wearable Health Telemetry & Data Governance",
    type: "research-assistant",
    lab: "Bio-IoT Systems & Analytics Group",
    sponsor: "Dr. Julian Chen, PhD",
    colleges: ["engineering", "business"],
    description: "Funded through an NSF Smart Health grant. Interest in HIPAA compliance standards expected.",
    skills: ["Python", "SQL", "HIPAA"],
    levels: ["undergraduate", "masters"],
    paid: true,
    hoursPerWeek: "10",
    term: "Spring 2025",
    deadline: "2025-03-01",
    verifiedByPI: true,
  },
];
