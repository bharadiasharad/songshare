# Senior Software Engineer- Take Home Assignment

# 🎯 Overview

<aside>
💡

**Mission:** Design and implement a **PROTOTYPE** backend API for a song-sharing platform that connects songwriter managers with their songwriters. This is an open-ended assignment designed to evaluate your API design skills, data modeling abilities, and capacity to leverage modern development tools.

**Time expectation:** > 1 hour

</aside>

<aside>
⛓️

Utilize the provided Backend Template, which already provides: Docker, better-auth, NestJs and prisma setup

</aside>

---

## 📋 Business Context

You're building a platform where:

- **Managers of Songwriters** manage and pitch their Songwriters song ideas within Organizations
- **Songwriters** create and upload songs to share with their managers
- **Managers** review songs, identify potential artists for each song idea and pitch the song idea to those artists

---

## 🔄 Core User Flows

1. Managers create organizations and invite songwriters
2. Songwriters join organizations and upload songs
3. Managers receive songs, add pitch information (tags, descriptions, target artists), and share within the industry

---

## 💻 Technical Requirements

### Tech Stack (Required)

- **Runtime:** Node.js with TypeScript
- **Framework:** NestJS
- **Database:** MySQL with Prisma ORM
- **Authentication:** better-auth (for auth, sessions, and organization management)
- **Deployment:** Docker (single container with both DB and server)

---

## ⚙️ Core Features to Implement

### ✅ Must Have (Minimum Viable Scope)

- **1. Authentication & User Management**
    - User registration and login
    - User roles (Manager, Songwriter)
    - User profile retrieval
- **2. Organization Management**
    - Managers can create organizations
    - Link songwriters to organizations (no email invite system needed - assume direct linking)
- **3. Song Management**
    - Songwriters can upload songs (store files on local filesystem)
    - Songs are linked to their manager's organization
    - Basic song metadata (title, artist, duration, etc.)
- **4. Pitch Creation**
    - Managers can create pitches for songs
    - Pitch includes: tags, description, target artists list
- **5. Database Schema**
    
    <aside>
    ⚠️
    
    **Critical:** Your schema should model the complete domain, including entities and relationships you may not have time to fully implement in the API
    
    Show us your data modeling thinking beyond just the MVP features
    
    </aside>
    

### 🎁 Nice to Have (If Time Permits)

- Song listing/filtering endpoints
- Update/delete operations
- More sophisticated authorization rules
- File metadata extraction
- Richer pitch management
- API documentation (Swagger/OpenAPI)

---

## 📦 Deliverables

### 1. 📁 GitHub Repository

Your repo should include:

- Complete source code
- docker-compose.yml for one-command startup
- Prisma schema with migrations
- .env.example file

### 2. 📖 README.md

Include:

- Setup instructions (should be: clone, copy .env, docker-compose up)
- API endpoint documentation
- Example requests (curl/Postman/REST client)
- Any assumptions you made

### 3. 📝 SOLUTION.md

A reflection document covering:

- **Your approach:** How did you think about the problem?
- **AI usage:** Which AI tools did you use and how? What worked well? What didn't?
- **Database design:** Explain your schema decisions
- **Trade-offs:** What did you prioritize and why?
- **Improvements:** What would you add with more time?
- **Challenges:** Any blockers or interesting problems you solved?

---

## 📜 Guidelines & Constraints

### ✅ What You Can Use

- Any LLM or AI coding assistant (Claude, ChatGPT, Cursor, GitHub Copilot, etc.)
- Any libraries or packages you find helpful
- Stack Overflow, documentation, or any online resources

### ❌ What We Don't Need

- Automated tests (focus on functionality)
- Email invite system (assume direct user linking)
- Frontend or UI
- Deployment to cloud services
- Complex audio processing or metadata extraction

---

## 🎯 Important Notes

<aside>
💡

- This is **open-ended by design**. Show us how you think and what you prioritize
- **Working code > Perfect code**. We value a functional submission over an incomplete perfect one
- **Document your decisions**. The SOLUTION.md is as important as the code
- **Use AI effectively**. We want to see how you leverage modern tools to build quickly
</aside>

---

## 📮 Submission

Send us:

1. Link to your GitHub repository (public or invite us as collaborators)
2. Ensure we can run `docker-compose up` and have a working API

---

## ❓ Questions?

If anything is unclear, make a reasonable assumption and document it in your SOLUTION.md. We intentionally leave some ambiguity to see how you handle real-world undefined requirements.