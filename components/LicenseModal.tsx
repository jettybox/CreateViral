import React from 'react';
import { XIcon } from './Icons';

interface LicenseModalProps {
  onClose: () => void;
}

// All license text is contained in this object, making it easy to edit in one place.
const LICENSE_INFO = {
  title: "Simple Royalty-Free License",
  summary: "This is a human-readable summary of the license. The full terms are below.",
  points: [
    "Use for any personal or commercial project.",
    "Use in advertising, social media, presentations, and more.",
    "No attribution or credit required (but always appreciated!).",
    "Modify the assets as you see fit.",
  ],
  restrictions_title: "What is not allowed?",
  restrictions: [
    "You cannot re-sell or re-distribute the original, unmodified assets on other stock platforms or as part of a template library.",
    "You cannot claim ownership of the original assets.",
  ],
  legal_preamble: "By downloading an asset from this site, you agree to the following terms:",
  legal_terms: `
1. Grant of License: We grant you a perpetual, non-exclusive, non-transferable, worldwide license to use the downloaded assets for Permitted Uses (defined below).

2. Permitted Uses: You may use the assets for any personal, business, or commercial purpose, including but not limited to websites, social media, advertising, marketing, presentations, and video productions. You may modify the assets as needed.

3. Prohibited Uses: You may not use the assets in a way that allows a third party to download, extract, or access the asset as a standalone file. You may not re-sell, re-license, or re-distribute the original, unmodified assets. You may not claim trademark or service mark rights over an asset.

4. No Warranty: The assets are provided "as is" without any warranty of any kind. We do not guarantee that the assets will meet your requirements or that their use will be uninterrupted or error-free.
  `,
  disclaimer: "This license is provided for guidance. We recommend consulting with a legal professional for any specific legal questions or concerns."
};


export const LicenseModal: React.FC<LicenseModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">{LICENSE_INFO.title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <XIcon className="w-6 h-6" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto text-gray-300 prose prose-invert prose-sm md:prose-base max-w-none">
            <div className="bg-gray-900/50 p-4 rounded-lg border border-indigo-500/30">
                <h3 className="!mt-0 text-indigo-400">{LICENSE_INFO.summary}</h3>
                <ul className="!my-2 !pl-0 !list-none space-y-1">
                    {LICENSE_INFO.points.map(point => (
                        <li key={point} className="flex items-start">
                           <span className="text-green-400 mr-2 flex-shrink-0">✅</span>
                           <span>{point}</span>
                        </li>
                    ))}
                </ul>
                 <h4 className="text-yellow-400 mt-4">{LICENSE_INFO.restrictions_title}</h4>
                 <ul className="!my-2 !pl-0 !list-none space-y-1">
                    {LICENSE_INFO.restrictions.map(point => (
                        <li key={point} className="flex items-start">
                           <span className="text-red-400 mr-2 flex-shrink-0">❌</span>
                           <span>{point}</span>
                        </li>
                    ))}
                </ul>
            </div>
          
            <h3 className="text-indigo-400 mt-6">Full Legal Terms</h3>
            <p className="text-sm italic">{LICENSE_INFO.legal_preamble}</p>
            <pre className="text-xs whitespace-pre-wrap font-sans bg-gray-900 p-4 rounded-md border border-gray-700">{LICENSE_INFO.legal_terms.trim()}</pre>
            <p className="text-xs text-gray-500 mt-4">{LICENSE_INFO.disclaimer}</p>
        </div>
      </div>
    </div>
  );
};
