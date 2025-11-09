import React from 'react';
import { XIcon } from './Icons';

interface GuidanceProps {
  onClose: () => void;
}

export const Guidance: React.FC<GuidanceProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">Production Architecture Guide</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <XIcon className="w-6 h-6" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto text-gray-300 prose prose-invert prose-sm md:prose-base max-w-none">
          <p>
            This is a fully functional **frontend** application. To build a complete, production-ready system, you need a **backend** to handle video storage, processing, and payments. Here’s a recommended, cost-effective, and scalable approach:
          </p>
          
          <div className="bg-gray-900/50 p-4 rounded-lg border border-indigo-500/30">
             <h3 className="text-indigo-400 !mt-0">The Core Concept: Frontend vs. Backend</h3>
             <p>
                The code in this project is the **frontend**—the "storefront" your users see. The automatic video analysis happens in a separate **backend** process that you will build.
             </p>
             <p>
                <strong>Question:</strong> "Where is the code that detects a new video in storage and runs the Gemini analysis?"
             </p>
             <p>
                <strong>Answer:</strong> That code doesn't live in this frontend project. It lives in a **serverless function**. However, the file <code className="text-xs">services/geminiService.ts</code> in this project contains the exact JavaScript logic you would copy into that serverless function to perform the analysis.
             </p>
          </div>

          <h3 className="text-indigo-400">1. Video Storage (The "Warehouse")</h3>
          <p>
            Instead of traditional hosting, use a modern object storage service. They are cheaper and more scalable for large files like videos.
          </p>
          <ul>
            <li><strong>Backblaze B2:</strong> Often the most cost-effective option for data storage and egress (downloads).</li>
            <li><strong>Amazon S3:</strong> Industry standard, highly reliable.</li>
            <li><strong>Google Cloud Storage:</strong> Excellent integration with other Google Cloud services.</li>
          </ul>
          <p><strong>Your Workflow:</strong> You upload your new videos directly to a "bucket" in one of these services. This is the only manual step.</p>

          <h3 className="text-indigo-400">2. Automated Processing (The Backend "Magic")</h3>
          <p>
            Use serverless functions to automatically process new videos. This is easy to maintain because you don't manage a server—it just runs when needed.
          </p>
          <ul>
            <li><strong>How it works:</strong> Configure your storage bucket (e.g., Backblaze B2) to send a "webhook" notification to a serverless function (e.g., AWS Lambda or Google Cloud Function) whenever a new video is added. This is the "trigger."</li>
            <li><strong>Inside the function:</strong>
                <ol>
                    <li>The function wakes up and gets the new video's location.</li>
                    <li>It uses a library like <code>FFmpeg</code> to extract frames.</li>
                    <li>It sends these frames to the <strong>Gemini API</strong> using the logic found in <code className="text-xs">services/geminiService.ts</code> to get the title, description, keywords, etc.</li>
                    <li>It saves this new metadata into your database (see step 3).</li>
                </ol>
            </li>
          </ul>

          <h3 className="text-indigo-400">3. Metadata Storage (The "Catalog")</h3>
          <p>
            You need a database to store the metadata for each video, along with the URL pointing to the video file in your object storage.
          </p>
          <ul>
            <li><strong>Firestore (Google):</strong> A NoSQL database that's easy to start with and scales automatically. Real-time updates push new videos to your website instantly.</li>
            <li><strong>DynamoDB (AWS):</strong> A fast and flexible NoSQL database, deeply integrated with the AWS ecosystem.</li>
          </ul>
          <p><strong>Your Frontend's Job:</strong> This website's only job is to read the data from this database and display it beautifully.</p>


          <h3 className="text-indigo-400">4. Website Hosting (This Application)</h3>
          <p>
            This React application is a "static site." Hosting for these is extremely cheap, often with generous free tiers.
          </p>
          <ul>
            <li><strong>Vercel:</strong> Optimized for modern frontend frameworks like React. Offers continuous deployment from GitHub.</li>
            <li><strong>Netlify:</strong> Another excellent choice with a great developer experience.</li>
            <li><strong>Firebase Hosting:</strong> Fast, secure, and integrates well with other Firebase services like Firestore.</li>
          </ul>
          
          <h3 className="text-indigo-400">5. Handling Payments</h3>
          <p>
            To handle purchases, you'll need to integrate a payment processor like <strong>Stripe</strong>. This also involves a serverless function to securely create payment sessions. After a successful payment, your backend would then provide a secure, temporary download link to the high-resolution video file from your storage bucket.
          </p>
          
          <p>This complete architecture is robust, scalable to millions of videos, and has a very low operational cost and maintenance burden.</p>
        </div>
      </div>
    </div>
  );
};