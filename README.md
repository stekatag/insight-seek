# ✨ InsightSeek

InsightSeek is an AI-powered platform for code and meeting analysis, designed to provide valuable insights from GitHub repositories and team meetings.

## 🚀 Features

### 📊 Repository Analysis

- **Code Understanding**: Ask questions about your GitHub repositories and get accurate answers
- **Commit Summaries**: AI-generated summaries of code changes to quickly understand repository history
- **Intelligent Indexing**: Automatic detection and indexing of modified files to keep your codebase up-to-date

### 🎙️ Meeting Analysis

- **Chapter Summaries**: Automatically generate summaries of key discussion points
- **Issue Tracking**: Identify action items and key topics from meetings
- **Language Support**: Currently supports English language recordings only

## 🛠️ Technology Stack

InsightSeek is built with a modern tech stack:

- **Frontend**: Next.js 15, React 19, Tailwind CSS, Radix UI
- **Backend**: tRPC, Prisma, PostgreSQL with vector extensions
- **AI**: Google Gemini AI, AssemblyAI, vector embeddings
- **Infrastructure**: Netlify serverless functions
- **Authentication**: Clerk

## 🚀 Deployment

This project is configured for deployment on Netlify, with serverless functions handling background processing like commit analysis and meeting transcription.

## 🔒 Security

InsightSeek prioritizes security with end-to-end encryption and follows industry-standard security practices and GDPR regulations. Repository data is processed securely and not permanently stored.

## 💳 Credits

Every new user receives 150 credits upon signup to start exploring InsightSeek's features right away.

InsightSeek requires credits for processing files and analyzing meetings. The credit system is designed to balance usage based on project size:

- 2 credits per file for reindexing
- Credits for meeting analysis based on duration

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 🐛 Issues

If you encounter any bugs or have feature requests, please open an issue on GitHub. I'm open to feedback and continuously working to improve InsightSeek.

## 📝 License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.
