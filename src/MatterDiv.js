const ReactDOM = require("react-dom");
import React, { useState, useRef, useEffect } from 'react';
const Matter = require("matter-js");
import debounce from 'lodash.debounce';
/**
 * useScroll React custom hook
 * Usage:
 *    const { scrollX, scrollY, scrollDirection } = useScroll();
 */

const MatterDiv = () => {

  // Set a single object `{ x: ..., y: ..., direction: ... }` once on init
  const [scroll, setScroll] = useState({
    y: document.body.getBoundingClientRect().top,
    direction: ''
  })

  const listener = e => {
    // `prev` provides us the previous state: https://reactjs.org/docs/hooks-reference.html#functional-updates
    setScroll(prev => ({
      y: -document.body.getBoundingClientRect().top,
      // Here we’re comparing the previous state to the current state to get the scroll direction
      direction: prev.y > -document.body.getBoundingClientRect().top ? 'up' : 'down'
    }))
  }

  const debounceWrapper = debounce(listener, 10); // Delay listener function for 10 ms

  useEffect(() => {
    window.addEventListener('scroll', debounceWrapper)
    // cleanup function occurs on unmount
    return () => window.removeEventListener('scroll', debounceWrapper)
  // Run `useEffect` only once on mount, so add `, []` after the closing curly brace }
  }, []);

  return(
    <p>{scroll.y},{scroll.direction}</p>
  );
}

export default MatterDiv;
