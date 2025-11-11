import React, { useState } from 'react';
import { WarningIcon, KeyIcon } from './Icons';

interface ApiKeyBannerProps {
  onSaveKey: (key: string) => void;
}

export const ApiKeyBanner: React.FC<ApiKeyBannerProps> = ({ onSaveKey }) => {
  const [keyInput, setKeyInput] = useState('');

  const handleSave = () => {
    if (keyInput.trim()) {
      onSaveKey(keyInput.trim());
    }
  };

  return (
    <div className="bg-yellow-900/30 border border-yellow-500/40 text-yellow-200 rounded-lg p-4 mb-8 flex items-start gap-4 shadow-lg">
      <WarningIcon className="w-8 h-8 text-yellow-400 flex-shrink-0 mt-1" />
      <div>
        <h3 className="font-bold text-lg text-yellow-300">Action Required: Set API Key</h3>
        <p className="text-sm mt-1">
          To enable AI-powered video analysis and search, please provide your Google Gemini API key.
          This key will be stored securely in your browser's local storage and will be remembered for future sessions.
        </p>
        <div className="mt-4 flex flex-col sm:flex-row gap-2">
          <div className="relative flex-grow">
            <KeyIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="Paste your Gemini API key here"
              className="w-full pl-10 pr-4 py-2 bg-gray-900/50 border border-yellow-500/50 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-400 text-white placeholder-gray-400"
            />
          </div>
          <button
            onClick={handleSave}
            disabled={!keyInput.trim()}
            className="px-4 py-2 bg-yellow-500 text-gray-900 font-bold rounded-md hover:bg-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-2 focus:ring-offset-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save &amp; Refresh
          </button>
        </div>
        <p className="text-xs text-yellow-400/70 mt-3">
          If you don't have a key, you can get one from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="underline hover:text-yellow-300">Google AI Studio</a>.
        </p>
      </div>
    </div>
  );
};