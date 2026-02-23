/**
 * SDL Engine — Skills Development Levy Calculation
 * Rate: 0.25% of total monthly wages
 * Min: S$2, Max: S$11.25 per employee
 */

const SDL_RATE = 0.0025;
const SDL_MIN = 2;
const SDL_MAX = 11.25;

/**
 * Calculate SDL for an employee
 * @param {number} totalWages - Total monthly wages
 * @returns {Object} SDL breakdown
 */
function calculateSDL(totalWages) {
    if (totalWages <= 0) {
        return { totalWages, sdl: 0 };
    }

    let sdl = totalWages * SDL_RATE;

    // Apply min and max
    if (totalWages < 800) {
        sdl = SDL_MIN;
    } else {
        sdl = Math.min(sdl, SDL_MAX);
        sdl = Math.max(sdl, SDL_MIN);
    }

    // Round to 2 decimal places
    sdl = Math.round(sdl * 100) / 100;

    return {
        totalWages,
        rate: SDL_RATE,
        sdl,
        min: SDL_MIN,
        max: SDL_MAX,
    };
}

module.exports = { calculateSDL, SDL_RATE, SDL_MIN, SDL_MAX };
