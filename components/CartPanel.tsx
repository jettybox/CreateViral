import React, { useMemo } from 'react';
import type { VideoFile } from '../types';
import { XIcon, TrashIcon, SparklesIcon } from './Icons';
import { Spinner } from './Spinner';

interface CartPanelProps {
  items: VideoFile[];
  onClose: () => void;
  onRemoveItem: (videoId: string) => void;
  onClearCart: () => void;
  onCheckout: () => void;
  isCheckingOut: boolean;
}

export const CartPanel: React.FC<CartPanelProps> = ({ items, onClose, onRemoveItem, onClearCart, onCheckout, isCheckingOut }) => {
  const { subtotal, discount, total } = useMemo(() => {
    const currentSubtotal = items.reduce((acc, item) => acc + item.price, 0);
    const itemCount = items.length;
    let currentDiscount = 0;

    const bundlesOf10 = Math.floor(itemCount / 10);
    const remainingAfter10 = itemCount % 10;
    const bundlesOf5 = Math.floor(remainingAfter10 / 5);

    // Standard prices: 10 for $50, 5 for $25.
    // Discount prices: 10 for $35 (save $15), 5 for $20 (save $5).
    currentDiscount += bundlesOf10 * 15;
    currentDiscount += bundlesOf5 * 5;
    
    const finalTotal = currentSubtotal - currentDiscount;

    return {
      subtotal: currentSubtotal,
      discount: currentDiscount,
      total: finalTotal,
    };
  }, [items]);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" aria-labelledby="slide-over-title" role="dialog" aria-modal="true">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-black bg-opacity-75 transition-opacity" onClick={onClose}></div>
        <div className="fixed inset-y-0 right-0 pl-10 max-w-full flex">
          <div className="w-screen max-w-md transform transition ease-in-out duration-500 sm:duration-700 translate-x-0">
            <div className="h-full flex flex-col bg-gray-800 shadow-xl overflow-y-scroll">
              <div className="flex-1 py-6 overflow-y-auto px-4 sm:px-6">
                <div className="flex items-start justify-between">
                  <h2 className="text-lg font-medium text-white" id="slide-over-title">Shopping Cart</h2>
                  <div className="ml-3 h-7 flex items-center">
                    <button type="button" className="-m-2 p-2 text-gray-400 hover:text-white" onClick={onClose}>
                      <span className="sr-only">Close panel</span>
                      <XIcon className="h-6 w-6" />
                    </button>
                  </div>
                </div>

                <div className="mt-8">
                  <div className="flow-root">
                    {items.length > 0 ? (
                      <>
                        <div className="p-3 bg-indigo-900/50 border border-indigo-500/30 rounded-md text-center mb-6">
                            <p className="text-sm text-indigo-200 flex items-center justify-center gap-2">
                                <SparklesIcon className="w-5 h-5 text-yellow-300 flex-shrink-0" />
                                <strong>Bundle &amp; Save!</strong> Discounts apply automatically.
                            </p>
                        </div>
                        <ul role="list" className="-my-6 divide-y divide-gray-700">
                          {items.map((item) => (
                              <li key={item.id} className="py-6 flex">
                                <div className="flex-shrink-0 w-24 h-14 border border-gray-700 rounded-md overflow-hidden bg-gray-900">
                                  <img 
                                    src={item.thumbnail || ''} 
                                    alt={item.title} 
                                    className="w-full h-full object-cover" 
                                    referrerPolicy="no-referrer"
                                    onError={(e) => (e.currentTarget.style.display = 'none')}
                                  />
                                </div>
                                <div className="ml-4 flex-1 flex flex-col">
                                  <div>
                                    <div className="flex justify-between text-base font-medium text-white">
                                      <h3>{item.title}</h3>
                                      <p className="ml-4">{item.isFree ? 'Free' : `$${item.price.toFixed(2)}`}</p>
                                    </div>
                                    <p className="mt-1 text-sm text-gray-400 truncate">{item.categories.join(', ')}</p>
                                  </div>
                                  <div className="flex-1 flex items-end justify-between text-sm">
                                    <p className="text-gray-500">Qty 1</p>
                                    <div className="flex">
                                      <button onClick={() => onRemoveItem(item.id)} type="button" className="font-medium text-indigo-400 hover:text-indigo-300">
                                        Remove
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </li>
                            )
                          )}
                        </ul>
                      </>
                    ) : (
                      <div className="text-center py-10">
                        <p className="text-gray-400">Your cart is empty.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {items.length > 0 && (
                <div className="border-t border-gray-700 py-6 px-4 sm:px-6">
                  <div className="space-y-2">
                     <div className="flex justify-between text-base font-medium text-gray-300">
                      <p>Subtotal</p>
                      <p>${subtotal.toFixed(2)}</p>
                    </div>
                    {discount > 0 && (
                       <div className="flex justify-between text-base font-medium text-green-400">
                        <p>Bundle Discount</p>
                        <p>-${discount.toFixed(2)}</p>
                      </div>
                    )}
                    <div className="flex justify-between text-lg font-bold text-white border-t border-gray-600 pt-2 mt-2">
                      <p>Total</p>
                      <p>${total.toFixed(2)}</p>
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-gray-400">Taxes and final total calculated at checkout.</p>
                  <div className="mt-6">
                    <button
                      onClick={onCheckout}
                      disabled={isCheckingOut}
                      className="w-full flex justify-center items-center px-6 py-3 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-wait"
                    >
                      {isCheckingOut ? (
                        <>
                          <Spinner className="w-5 h-5 mr-3" />
                          Processing...
                        </>
                      ) : (
                        total > 0 ? `Proceed to Checkout` : 'Get Free Downloads'
                      )}
                    </button>
                  </div>
                   <div className="mt-4 flex justify-center text-sm text-center text-gray-400">
                    <button type="button" className="font-medium hover:text-white" onClick={onClearCart}>
                       <TrashIcon className="w-4 h-4 inline mr-1" />
                       Clear Cart
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
