import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { BrainCircuit, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { useReviewQueue } from './useReviewQueue';
import type { Grade } from '../../lib/srs';

const GRADES: { value: Grade; label: string; hint: string; className: string }[] = [
  {
    value: 1,
    label: 'Again',
    hint: 'Tomorrow',
    className:
      'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900',
  },
  {
    value: 2,
    label: 'Hard',
    hint: 'Sooner',
    className:
      'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900',
  },
  {
    value: 3,
    label: 'Good',
    hint: 'On track',
    className:
      'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900',
  },
  {
    value: 4,
    label: 'Easy',
    hint: 'Later',
    className:
      'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900',
  },
];

export function ReviewPage() {
  const { current, remaining, isLoading, isGrading, grade } = useReviewQueue();
  const [selected, setSelected] = useState<number | null>(null);
  const [gradedThisSession, setGradedThisSession] = useState(0);

  useEffect(() => {
    setSelected(null);
  }, [current?.id]);

  const isAnswered = selected !== null;

  const submitGrade = useCallback(
    (value: Grade) => {
      setGradedThisSession((count) => count + 1);
      void grade(value);
    },
    [grade],
  );

  /**
   * Number keys, because this is a keyboard-shaped task: read, decide, rate,
   * repeat, dozens of times. Every desk spaced-repetition tool grades from the
   * number row for that reason, and reaching for the mouse between each card is
   * most of the friction in a review session. 1-4 picks an answer, then 1-4
   * grades it — the same keys, because at any moment only one of those two
   * things is what the screen is asking for.
   */
  useEffect(() => {
    if (!current) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && /^(INPUT|TEXTAREA)$/.test(target.tagName)) return;

      const n = Number(event.key);
      if (!Number.isInteger(n) || n < 1 || n > 4) return;

      if (!isAnswered) {
        if (n <= current.options.length) {
          event.preventDefault();
          setSelected(n - 1);
        }
        return;
      }
      if (isGrading) return;
      event.preventDefault();
      submitGrade(n as Grade);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [current, isAnswered, isGrading, submitGrade]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="animate-spin text-orange-700 dark:text-orange-400" size={32} />
      </div>
    );
  }

  if (!current) {
    // Two different nothings. Clearing a deck is the good outcome of the whole
    // feature and it used to land on the same "Nothing due — take a quiz to
    // build your deck" screen as someone who has never reviewed anything, so
    // finishing a session read as having achieved nothing.
    const justFinished = gradedThisSession > 0;
    return (
      <div className="max-w-2xl mx-auto flex flex-col items-center justify-center py-24 text-center">
        <div
          className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 ${
            justFinished ? 'bg-emerald-50 dark:bg-emerald-950' : 'bg-gray-100 dark:bg-gray-800'
          }`}
        >
          {justFinished ? (
            <CheckCircle2 size={40} className="text-emerald-600 dark:text-emerald-400" />
          ) : (
            <BrainCircuit size={40} className="text-gray-300 dark:text-gray-600" />
          )}
        </div>
        <h1 className="text-2xl font-serif font-bold text-gray-900 dark:text-gray-100 mb-2">
          {justFinished ? "That's the deck cleared" : 'Nothing due'}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 max-w-sm mb-8">
          {justFinished
            ? `${gradedThisSession} ${gradedThisSession === 1 ? 'card' : 'cards'} reviewed. They come back on their own schedule — the ones you knew well, later.`
            : 'Take a quiz on any book to build your review deck. Cards come back on a schedule that stretches as you get them right.'}
        </p>
        <Link
          to="/"
          className="bg-orange-600 hover:bg-orange-700 text-white px-8 py-3 rounded-xl font-bold shadow-lg transition-all"
        >
          Back to library
        </Link>
      </div>
    );
  }

  const isCorrect = selected === current.correctAnswerIndex;

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-serif font-bold text-gray-900 dark:text-gray-100">Review</h1>
        <span className="text-sm font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">
          {remaining} due
        </span>
      </header>

      <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 p-6 sm:p-8 shadow-sm">
        <h2 className="text-xl font-serif font-bold text-gray-900 dark:text-gray-100 mb-6 leading-relaxed">
          {current.question}
        </h2>

        <div className="space-y-3">
          {current.options.map((option, index) => {
            const showCorrect = isAnswered && index === current.correctAnswerIndex;
            const showWrong = isAnswered && index === selected && !isCorrect;
            return (
              <button
                // Keyed by position, not by text. Model-generated options are
                // not guaranteed distinct, and two identical strings gave React
                // two siblings with the same key — so selecting one highlighted
                // the other, on the screen whose entire job is telling you
                // whether you were right.
                key={index}
                onClick={() => !isAnswered && setSelected(index)}
                disabled={isAnswered}
                className={`w-full text-left p-4 rounded-xl border-2 font-medium transition-all flex items-start gap-3 ${
                  showCorrect
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950'
                    : showWrong
                      ? 'border-red-500 bg-red-50 dark:bg-red-950'
                      : 'border-gray-200 dark:border-gray-700 hover:border-orange-300'
                }`}
              >
                {showCorrect && <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />}
                {showWrong && <XCircle size={20} className="text-red-600 shrink-0" />}
                <span className="text-gray-900 dark:text-gray-100">{option}</span>
              </button>
            );
          })}
        </div>

        {isAnswered && (
          <div className="mt-6 p-4 rounded-xl bg-gray-50 dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300">
            <p className="font-bold mb-1">Explanation</p>
            {current.explanation}
          </div>
        )}
      </div>

      {isAnswered && (
        <div>
          <p className="text-sm font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-3">
            How well did you know it?{' '}
            <span className="font-normal normal-case tracking-normal opacity-70">
              (or press 1-4)
            </span>
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {GRADES.map(({ value, label, hint, className }) => (
              <button
                key={value}
                onClick={() => submitGrade(value)}
                disabled={isGrading}
                className={`p-4 rounded-2xl font-bold transition-all disabled:opacity-50 ${className}`}
              >
                {label}
                <span className="block text-[10px] font-semibold uppercase tracking-widest opacity-70">
                  {hint}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
