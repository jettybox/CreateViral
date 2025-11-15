import React from 'react';

export const DiscountBanner: React.FC = () => {
  return (
    <div className="text-center py-16 md:py-24 px-4 my-8 rounded-xl bg-black/20">
      <h2 className="font-heading text-4xl md:text-6xl font-extrabold text-white leading-tight">
        Create The <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">Impossible</span>.
      </h2>
      <p className="mt-4 max-w-2xl mx-auto text-lg text-gray-300">
        Video Elements & VFX for your next creative breakthrough.
      </p>
      <div className="mt-8">
        <a 
          href="#/free-clips"
          onClick={(e) => {
            e.preventDefault();
            const freeButton = Array.from(document.querySelectorAll('button')).find(btn => btn.textContent === 'Free');
            freeButton?.click();
            const mainElement = document.querySelector('main');
            if (mainElement) {
              window.scrollTo({ top: mainElement.offsetTop, behavior: 'smooth' });
            }
          }}
          className="font-heading inline-block bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold py-3 px-8 rounded-lg transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-black shadow-lg"
        >
          Download Free Clips
        </a>
      </div>
      <div className="mt-6">
        <div className="flex justify-center items-center gap-4">
          <button disabled className="font-heading bg-transparent border border-gray-600 text-gray-400 font-bold py-3 px-8 rounded-lg transition-colors opacity-50 cursor-not-allowed">
            Login
          </button>
          <button disabled className="font-heading bg-transparent border border-gray-600 text-gray-400 font-bold py-3 px-8 rounded-lg transition-colors opacity-50 cursor-not-allowed">
            Subscribe
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">Login & Subscription features coming soon!</p>
      </div>
    </div>
  );
};
