/**
 * Point System - Calculation Utilities
 *
 * Session base:
 *   - +10pt per correct answer
 *   - Perfect score bonus: x1.5 multiplier
 *
 * Daily bonuses:
 *   - Daily challenge bonus (first challenge of the day)
 *   - Consecutive correct answer streak bonus (every 10 consecutive correct answers in a day)
 */

export const POINTS_PER_CORRECT = 10;
export const PERFECT_BONUS_MULTIPLIER = 1.5;
export const DAILY_CHALLENGE_BONUS_POINTS = 20;
export const CONSECUTIVE_CORRECT_STREAK_THRESHOLD = 10;
export const CONSECUTIVE_CORRECT_STREAK_BONUS_POINTS = 50;

export interface PointsResult {
  /** Points earned from correct answers only */
  basePoints: number;
  /** Additional points from bonuses (e.g., perfect score) */
  bonusPoints: number;
  /** Total points earned this session */
  totalPoints: number;
  /** Whether the session was a perfect score */
  isPerfect: boolean;
}

/**
 * Calculate points earned for a quiz session.
 *
 * @param correctCount - Number of correct answers
 * @param totalQuestions - Total number of questions in the session
 * @returns Breakdown of points earned
 */
export function calculateSessionPoints(
  correctCount: number,
  totalQuestions: number,
): PointsResult {
  const basePoints = correctCount * POINTS_PER_CORRECT;
  const isPerfect = correctCount === totalQuestions && totalQuestions > 0;

  // Perfect bonus: the extra portion (x1.5 means +50% extra)
  const bonusPoints = isPerfect
    ? Math.floor(basePoints * (PERFECT_BONUS_MULTIPLIER - 1))
    : 0;

  return {
    basePoints,
    bonusPoints,
    totalPoints: basePoints + bonusPoints,
    isPerfect,
  };
}
