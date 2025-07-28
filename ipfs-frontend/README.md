# IPFS Frontend

A minimalist React Vite application for managing files on an IPFS blockchain network.

## Features

- **File Upload**: Drag and drop or click to upload files to IPFS
- **File Download**: Download files using their IPFS hash
- **File Management**: View uploaded files and storage usage
- **Responsive Design**: Works on both desktop and mobile devices
- **Clean UI**: Minimalist black and white design inspired by shadcn/ui

## Getting Started

### Prerequisites

- Node.js 18 or higher
- npm or pnpm

### Installation

1. Install dependencies:
\`\`\`bash
npm install
\`\`\`

2. Copy environment variables:
\`\`\`bash
cp .env.example .env
\`\`\`

3. Update the API base URL in `.env` if needed:
\`\`\`
VITE_API_BASE_URL=http://localhost:8000
\`\`\`

### Development

Start the development server:
\`\`\`bash
npm run dev
\`\`\`

The application will be available at `http://localhost:5173`

### Building for Production

Build the application:
\`\`\`bash
npm run build
\`\`\`

Preview the production build:
\`\`\`bash
npm run preview
\`\`\`

## Docker

### Building the Docker Image

\`\`\`bash
docker build -t ipfs-frontend .
\`\`\`

### Running the Container

\`\`\`bash
docker run -p 3000:80 ipfs-frontend
\`\`\`

The application will be available at `http://localhost:3000`

## API Integration

The frontend expects the following API endpoints:

- `POST /api/files/upload` - Upload a file
- `GET /api/files/download/:hash` - Download a file by hash
- `GET /api/files` - Get list of uploaded files
- `GET /api/storage` - Get storage usage information
- `DELETE /api/files/:hash` - Delete a file

## Project Structure

\`\`\`
src/
├── components/
│   ├── ui/           # shadcn/ui components
│   ├── FileUpload.tsx
│   ├── FileDownload.tsx
│   └── FileManager.tsx
├── services/
│   └── api.ts        # API service layer
├── lib/
│   └── utils.ts      # Utility functions
└── App.tsx           # Main application component
\`\`\`

## Technologies Used

- React 18
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui
- Axios
- Radix UI
