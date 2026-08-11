
import React, { useState, useEffect } from 'react';
import type { BookInsight, QuizQuestion } from '../types';
import { X, Trophy, AlertCircle, CheckCircle2, XCircle, ArrowRight, Loader2, BrainCircuit } from 'lucide-react';
import { generateBookQuiz } from '../services/geminiService';

interface QuizModalProps {
  book: BookInsight;
  onClose: () => void;
}

export const QuizModal: React.FC<QuizModalProps> = ({ book, onClose }) => {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [isFinished, setIsFinished] = useState(false);

  useEffect(() => {
    const loadQuiz = async () => {
      try {
        const quizData = await generateBookQuiz(book);
        setQuestions(quizData);
      } catch (error) {
        console.error("Failed to generate quiz", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadQuiz();
  }, [book]);

  const handleOptionClick = (index: number) => {
    if (isAnswered) return;
    setSelectedOption(index);
    setIsAnswered(true);
    
    if (index === questions[currentQuestionIndex].correctAnswerIndex) {
      setScore(s => s + 1);
    }
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedOption(null);
      setIsAnswered(false);
    } else {
      setIsFinished(true);
    }
  };

  const getPercentage = () => Math.round((score / questions.length) * 100);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 min-h-[400px] flex flex-col">
        {isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 animate-pulse">
              <BrainCircuit size={32} />
            </div>
            <h3 className="text-xl font-bold text-gray-900">Generating Knowledge Check...</h3>
            <p className="text-gray-500 max-w-xs">
              AI is crafting specific questions to test your understanding of "{book.title}".
            </p>
            <Loader2 className="animate-spin text-orange-500 mt-4" size={24} />
          </div>
        ) : questions.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <AlertCircle size={48} className="text-red-400 mb-4" />
            <p className="text-gray-900 font-bold mb-2">Could not generate quiz.</p>
            <button onClick={onClose} className="text-orange-600 font-bold hover:underline">Close</button>
          </div>
        ) : isFinished ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gradient-to-br from-orange-500 to-rose-600 text-white relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
            
            <div className="w-24 h-24 bg-white text-orange-600 rounded-full flex items-center justify-center shadow-xl mb-6 animate-in zoom-in duration-500">
               <Trophy size={48} fill="currentColor" />
            </div>
            
            <h2 className="text-4xl font-serif font-bold mb-2">{getPercentage()}%</h2>
            <p className="text-orange-100 text-lg mb-8 font-medium">
              You answered {score} out of {questions.length} correctly!
            </p>
            
            <button 
              onClick={onClose}
              className="px-8 py-3 bg-white text-orange-600 rounded-xl font-bold hover:bg-orange-50 transition-colors shadow-lg"
            >
              Complete
            </button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-widest text-orange-600 bg-orange-100 px-2 py-1 rounded-md">
                   Question {currentQuestionIndex + 1}/{questions.length}
                </span>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-900 transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Question Area */}
            <div className="flex-1 p-6 md:p-8 overflow-y-auto">
              <h3 className="text-xl font-serif font-bold text-gray-900 mb-6 leading-relaxed">
                {questions[currentQuestionIndex].question}
              </h3>

              <div className="space-y-3">
                {questions[currentQuestionIndex].options.map((option, idx) => {
                  const isCorrect = idx === questions[currentQuestionIndex].correctAnswerIndex;
                  const isSelected = selectedOption === idx;
                  
                  let buttonStyle = "border-gray-200 hover:bg-gray-50 text-gray-700"; // Default
                  
                  if (isAnswered) {
                    if (isCorrect) {
                      buttonStyle = "bg-emerald-100 border-emerald-300 text-emerald-800";
                    } else if (isSelected) {
                      buttonStyle = "bg-red-100 border-red-300 text-red-800";
                    } else {
                      buttonStyle = "opacity-50 border-gray-100 text-gray-400";
                    }
                  } else if (isSelected) {
                     buttonStyle = "border-orange-500 bg-orange-50 text-orange-800";
                  }

                  return (
                    <button
                      key={idx}
                      onClick={() => handleOptionClick(idx)}
                      disabled={isAnswered}
                      className={`w-full text-left p-4 rounded-xl border-2 font-medium transition-all duration-200 flex items-start gap-3 ${buttonStyle}`}
                    >
                      <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                         isAnswered && isCorrect ? 'border-emerald-500 bg-emerald-500 text-white' :
                         isAnswered && isSelected && !isCorrect ? 'border-red-500 bg-red-500 text-white' :
                         'border-gray-300'
                      }`}>
                         {isAnswered && isCorrect && <CheckCircle2 size={12} />}
                         {isAnswered && isSelected && !isCorrect && <XCircle size={12} />}
                      </div>
                      <span className="leading-snug">{option}</span>
                    </button>
                  );
                })}
              </div>

              {isAnswered && (
                <div className="mt-6 p-4 bg-blue-50 text-blue-800 rounded-xl border border-blue-100 animate-in fade-in slide-in-from-bottom-2">
                  <p className="font-bold text-sm mb-1">Explanation:</p>
                  <p className="text-sm leading-relaxed opacity-90">{questions[currentQuestionIndex].explanation}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-100 bg-white">
              <button 
                onClick={handleNext}
                disabled={!isAnswered}
                className="w-full py-3.5 bg-gray-900 text-white rounded-xl font-bold shadow-lg disabled:opacity-50 disabled:shadow-none transition-all flex items-center justify-center gap-2"
              >
                {currentQuestionIndex === questions.length - 1 ? 'Finish Quiz' : 'Next Question'}
                <ArrowRight size={18} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
