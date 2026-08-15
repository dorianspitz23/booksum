import React, { useId, useState, useEffect, useRef } from 'react';
import { useFocusTrap } from './ui/useFocusTrap';
import type { Book, Summary } from '../types';
import type { QuizQuestion } from '../types';
import {
  X,
  Trophy,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Loader2,
  BrainCircuit,
} from 'lucide-react';
import { generateBookQuiz } from '../lib/ai/quiz';
import { reviewCards } from '../lib/storage/repo';
import { newCard } from '../lib/srs';
import { toast } from './ui/toastStore';
import { toAiError } from '../lib/ai/errors';

interface QuizModalProps {
  book: Book;
  summary: Summary;
  onClose: () => void;
}

export const QuizModal: React.FC<QuizModalProps> = ({ book, summary, onClose }) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useFocusTrap(panelRef, { active: true, onClose });

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
        const quizData = await generateBookQuiz(book, summary);
        setQuestions(quizData);

        // Every generated question becomes a review card, skipping any question
        // already stored for this book so retaking a quiz cannot duplicate them.
        const seen = new Set((await reviewCards.listByBook(book.id)).map((c) => c.question));
        for (const question of quizData) {
          if (seen.has(question.question)) continue;
          await reviewCards.upsert(
            newCard({
              profileId: book.profileId,
              bookId: book.id,
              question: question.question,
              options: question.options,
              correctAnswerIndex: question.correctAnswerIndex,
              explanation: question.explanation,
            }),
          );
        }
      } catch (error) {
        console.error('Failed to generate quiz', error);
        toast.error(toAiError(error).message);
      } finally {
        setIsLoading(false);
      }
    };
    loadQuiz();
  }, [book, summary]);

  const handleOptionClick = (index: number) => {
    if (isAnswered) return;
    setSelectedOption(index);
    setIsAnswered(true);

    if (index === questions[currentQuestionIndex].correctAnswerIndex) {
      setScore((s) => s + 1);
    }
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
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

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 min-h-[400px] flex flex-col"
      >
        <h2 id={titleId} className="sr-only">
          Knowledge check for {book.title}
        </h2>
        {isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-orange-100 dark:bg-orange-950 rounded-full flex items-center justify-center text-orange-700 dark:text-orange-400 animate-pulse">
              <BrainCircuit size={32} />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              Generating Knowledge Check...
            </h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-xs">
              AI is crafting specific questions to test your understanding of "{book.title}".
            </p>
            <Loader2 className="animate-spin text-orange-500 mt-4" size={24} />
          </div>
        ) : questions.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <AlertCircle size={48} className="text-red-400 mb-4" />
            <p className="text-gray-900 dark:text-gray-100 font-bold mb-2">
              Could not generate quiz.
            </p>
            <button
              onClick={onClose}
              className="text-orange-700 dark:text-orange-400 font-bold hover:underline"
            >
              Close
            </button>
          </div>
        ) : isFinished ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gradient-to-br from-orange-500 to-rose-600 text-white relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>

            <div className="w-24 h-24 bg-white dark:bg-gray-900 text-orange-700 dark:text-orange-400 rounded-full flex items-center justify-center shadow-xl mb-6 animate-in zoom-in duration-500">
              <Trophy size={48} fill="currentColor" />
            </div>

            <h2 className="text-4xl font-serif font-bold mb-2">{getPercentage()}%</h2>
            <p className="text-orange-100 text-lg mb-8 font-medium">
              You answered {score} out of {questions.length} correctly!
            </p>

            <button
              onClick={onClose}
              className="px-8 py-3 bg-white dark:bg-gray-900 text-orange-700 dark:text-orange-400 rounded-xl font-bold hover:bg-orange-50 dark:hover:bg-orange-950 transition-colors shadow-lg"
            >
              Complete
            </button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50 dark:bg-gray-800/50">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-widest text-orange-700 dark:text-orange-400 bg-orange-100 dark:bg-orange-950 px-2 py-1 rounded-md">
                  Question {currentQuestionIndex + 1}/{questions.length}
                </span>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Question Area */}
            <div className="flex-1 p-6 md:p-8 overflow-y-auto">
              <h3 className="text-xl font-serif font-bold text-gray-900 dark:text-gray-100 mb-6 leading-relaxed">
                {questions[currentQuestionIndex].question}
              </h3>

              <div className="space-y-3">
                {questions[currentQuestionIndex].options.map((option, idx) => {
                  const isCorrect = idx === questions[currentQuestionIndex].correctAnswerIndex;
                  const isSelected = selectedOption === idx;

                  let buttonStyle =
                    'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'; // Default

                  if (isAnswered) {
                    if (isCorrect) {
                      buttonStyle =
                        'bg-emerald-100 border-emerald-300 text-emerald-800 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-200';
                    } else if (isSelected) {
                      buttonStyle =
                        'bg-red-100 border-red-300 text-red-800 dark:bg-red-950 dark:border-red-800 dark:text-red-200';
                    } else {
                      buttonStyle =
                        'opacity-50 border-gray-100 dark:border-gray-800 text-gray-400 dark:text-gray-500';
                    }
                  } else if (isSelected) {
                    buttonStyle =
                      'border-orange-500 bg-orange-50 dark:bg-orange-950 text-orange-800 dark:text-orange-200';
                  }

                  return (
                    <button
                      key={idx}
                      onClick={() => handleOptionClick(idx)}
                      disabled={isAnswered}
                      className={`w-full text-left p-4 rounded-xl border-2 font-medium transition-all duration-200 flex items-start gap-3 ${buttonStyle}`}
                    >
                      <div
                        className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                          isAnswered && isCorrect
                            ? 'border-emerald-500 bg-emerald-500 text-white'
                            : isAnswered && isSelected && !isCorrect
                              ? 'border-red-500 bg-red-500 text-white'
                              : 'border-gray-300 dark:border-gray-600'
                        }`}
                      >
                        {isAnswered && isCorrect && <CheckCircle2 size={12} />}
                        {isAnswered && isSelected && !isCorrect && <XCircle size={12} />}
                      </div>
                      <span className="leading-snug">{option}</span>
                    </button>
                  );
                })}
              </div>

              {isAnswered && (
                <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950 text-blue-800 dark:text-blue-200 rounded-xl border border-blue-100 dark:border-blue-900 animate-in fade-in slide-in-from-bottom-2">
                  <p className="font-bold text-sm mb-1">Explanation:</p>
                  <p className="text-sm leading-relaxed opacity-90">
                    {questions[currentQuestionIndex].explanation}
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
              <button
                onClick={handleNext}
                disabled={!isAnswered}
                className="w-full py-3.5 bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 rounded-xl font-bold shadow-lg disabled:opacity-50 disabled:shadow-none transition-all flex items-center justify-center gap-2"
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
