import React from 'react';
import { XIcon, WarningIcon } from './Icons';

interface TroubleshootingProps {
  onClose: () => void;
}

export const Troubleshooting: React.FC<TroubleshootingProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">Video Playback Troubleshooting</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <XIcon className="w-6 h-6" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto text-gray-300 prose prose-invert prose-sm md:prose-base max-w-none">
          
          <div className="bg-red-900/30 border border-red-500/40 text-red-200 rounded-lg p-4 mb-6">
            <h3 className="!mt-0 font-bold text-lg text-red-300 flex items-center gap-2">
                <WarningIcon className="w-6 h-6" />
                The Mystery: "My `.mov` files were working, but now they won't play."
            </h3>
            <p className="text-sm mt-2">
                You are right to be confused. This happens because browser support for <code>.mov</code> is inconsistent and unreliable.
            </p>
            <p className="text-sm mt-2">
                Think of <code>.mov</code> as a container format—a box. A browser might be able to open some boxes, but not all of them. Whether it works depends on the specific video "codec" inside the box. <strong>Browsers are constantly being updated, and a recent automatic update likely removed support for the codec your `.mov` files were using.</strong>
            </p>
             <p className="text-sm font-bold mt-3 text-green-300">
                While it seemed to work before, it was never guaranteed. The only permanent solution is to convert your videos to the universal web standard: <code>.mp4</code>.
            </p>
          </div>

          <h3 className="text-indigo-400">Step 1: Convert All Videos to the Web-Standard `.mp4` Format</h3>
          <p>
            This is the most critical step. Before uploading, you must convert all videos to <code>.mp4</code>. This format is guaranteed to play in all modern web browsers, today and in the future.
          </p>
          <ul>
            <li><strong>Why?</strong> The <code>.mp4</code> container with an H.264 video codec is the official standard for the web. It removes all guesswork.</li>
            <li><strong>Recommended Tool:</strong> <a href="https://handbrake.fr/" target="_blank" rel="noopener noreferrer">HandBrake</a> is a free, powerful, and easy-to-use tool for converting videos. Use its "Fast 1080p30" or general "Web" presets for excellent results.</li>
          </ul>

          <h3 className="text-indigo-400">Step 2: Verify Your Bucket is "Public"</h3>
          <p>This is a one-time check to ensure your bucket is accessible.</p>
          <ol className="text-sm pl-5 list-decimal">
              <li>In Backblaze, go to your bucket and click <strong>"Bucket Settings"</strong>.</li>
              <li>For the setting <code className="text-xs">Bucket is</code>, ensure it is set to <strong>Public</strong>. Save changes.</li>
          </ol>

          <h3 className="text-indigo-400">Step 3: Set Correct CORS Rules</h3>
          <p>This allows the app to display images and videos from your bucket.</p>
          <ol className="text-sm pl-5 list-decimal mt-2">
              <li>In "Bucket Settings", find and click on <strong>"CORS Rules"</strong>.</li>
              <li>Select the option: <strong>"Share everything in this bucket with every origin"</strong>. This is the simplest and most reliable choice.</li>
              <li>Click <strong>"Update CORS Rules"</strong> to save.</li>
          </ol>

          <h3 className="text-indigo-400">Step 4: Upload Your New `.mp4` Files</h3>
          <p>
            Now that your source files are in the correct format, upload the new <code>.mp4</code> versions to your public Backblaze B2 bucket.
          </p>

          <h3 className="text-indigo-400">Step 5: Re-run the Bulk Import</h3>
           <p>
            The final step is to update your app's database with the correct links to your new <code>.mp4</code> files. For a clean slate, you should delete the old video records in your Firestore database before re-importing.
           </p>
           <ol className="text-sm pl-5 list-decimal mt-2">
              <li>In this app, open the <strong>Bulk Importer</strong> (upload icon in the header).</li>
              <li>Use your bucket's Friendly URL as the prefix (e.g., <code>https://f005.backblazeb2.com/file/your-bucket-name/</code>).</li>
              <li>Select your CSV file (make sure it references the new <code>.mp4</code> filenames) and run the import.</li>
          </ol>
          <p>By following these steps and standardizing on <code>.mp4</code>, your videos will be robustly playable across all platforms.</p>

        </div>
      </div>
    </div>
  );
};
