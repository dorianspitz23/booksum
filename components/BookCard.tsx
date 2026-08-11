
import React, { useState, useEffect } from 'react';
import { BookInsight } from '../types';
import { Clock, Star, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';

interface BookCardProps {
  book: BookInsight;
  onClick: (book: BookInsight) => void;
}

export const BookCard: React.FC<BookCardProps> = ({ book, onClick }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imgSrc, setImgSrc] = useState(book.coverImageUrl);

  useEffect(() => {
    // Immediate fallback if the URL is empty to prevent broken image flash
    if (!book.coverImageUrl || book.coverImageUrl === 'null') {
        handleError();
    } else {
        setImgSrc(book.coverImageUrl);
        setImageLoaded(false);
    }
  }, [book.coverImageUrl, book.title]);

  const handleError = () => {
    // Fallback to a clean UI Avatar if the real image fails
    setImgSrc(`https://ui-avatars.com/api/?name=${encodeURIComponent(book.title)}&background=f97316&color=fff&size=600&bold=true&format=svg`);
    setImageLoaded(true);
  };

  const getPriorityColor = (p?: string) => {
    switch (p) {
      case 'High': return 'bg-rose-100 text-rose-700 border-rose-200';
      case 'Medium': return 'bg-amber-100 text-amber-700 border-amber-200';
      default: return 'bg-blue-100 text-blue-700 border-blue-200';
    }
  };

  return (
    <div 
      onClick={() => onClick(book)}
      className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-500 cursor-pointer border border-gray-100 flex flex-col h-full"
    >
      <div className="relative aspect-[3/4.5] overflow-hidden bg-gray-50">
        {!imageLoaded && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-200">
            <Loader2 className="animate-spin" size={24} />
          </div>
        )}
        <img 
          src={imgSrc} 
          alt={book.title}
          onLoad={() => setImageLoaded(true)}
          onError={handleError}
          className={`w-full h-full object-cover transition-all duration-700 ${imageLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-105'} group-hover:scale-110`}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-5">
          <span className="text-white text-sm font-bold flex items-center gap-2 tracking-wide">
            Read Masterclass <ArrowRight size={16} />
          </span>
        </div>
        <div className="absolute top-4 left-4 flex flex-col gap-2">
          <div className="bg-white/95 backdrop-blur shadow-xl px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-[0.1em] text-orange-700 w-fit">
            {book.category}
          </div>
          {book.status === 'Want to Read' && book.priority && (
            <div className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-[0.1em] border backdrop-blur-md shadow-xl flex items-center gap-1.5 w-fit ${getPriorityColor(book.priority)}`}>
              <AlertCircle size={12} />
              {book.priority}
            </div>
          )}
        </div>
      </div>
      
      <div className="p-6 flex-grow flex flex-col">
        <h3 className="text-xl font-serif font-bold text-gray-900 line-clamp-2 mb-2 group-hover:text-orange-700 transition-colors leading-tight">
          {book.title}
        </h3>
        <p className="text-sm font-medium text-gray-500 mb-4 tracking-tight">by {book.author}</p>
        
        <p className="text-sm text-gray-600 line-clamp-3 mb-6 leading-relaxed italic border-l-2 border-orange-100 pl-4">
          "{book.oneSentenceTakeaway}"
        </p>
        
        <div className="mt-auto pt-5 border-t border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2 text-gray-400 font-bold text-[10px] uppercase tracking-widest">
            <Clock size={14} className="text-orange-500" />
            <span>{book.readingTimeMinutes} min read</span>
          </div>
          {book.status === 'Finished' && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-50 rounded-md">
              <Star size={12} className="text-amber-500 fill-amber-500" />
              <span className="font-black text-amber-700 text-[10px]">{book.rating}/5</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
