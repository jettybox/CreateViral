import React from 'react';
import { XIcon } from './Icons';

interface AboutModalProps {
  onClose: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">About GenieClips.com</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <XIcon className="w-6 h-6" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto text-gray-300 space-y-4">
          <p>
            Welcome to GenieClips.com, a curated library of high-quality, royalty-free video clips designed for modern creators.
          </p>
          <p>
            All assets on this site are created by <strong className="text-indigo-400">SP3N</strong> to help you produce amazing content without worrying about copyright strikes or complex licensing.
          </p>
          <div className="text-center mt-4">
            <a 
              href="https://www.youtube.com/@SP3NCreatorLab" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-block bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold py-2 px-4 rounded-lg transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-gray-800"
            >
              Visit SP3N Creator Lab on YouTube
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
