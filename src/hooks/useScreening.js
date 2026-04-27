/**
 * useScreening.js
 * Custom hook for managing screening session state and submission.
 */

import { useState, useCallback, useReducer } from 'react';
import { screeningApi } from '../services/api';
import { SCREENING_TOOLS } from '../data/mockData';

const initialState = {
  activeToolId: null,
  currentStep: 0,
  responses: {},
  isSubmitting: false,
  result: null,
  error: null,
};

function screeningReducer(state, action) {
  switch (action.type) {
    case 'SELECT_TOOL':
      return { ...initialState, activeToolId: action.toolId };

    case 'ANSWER_QUESTION':
      return {
        ...state,
        responses: {
          ...state.responses,
          [action.questionId]: action.answer,
        },
      };

    case 'NEXT_STEP':
      return { ...state, currentStep: state.currentStep + 1 };

    case 'PREV_STEP':
      return { ...state, currentStep: Math.max(0, state.currentStep - 1) };

    case 'SUBMIT_START':
      return { ...state, isSubmitting: true, error: null };

    case 'SUBMIT_SUCCESS':
      return { ...state, isSubmitting: false, result: action.result };

    case 'SUBMIT_ERROR':
      return { ...state, isSubmitting: false, error: action.error };

    case 'RESET':
      return initialState;

    default:
      return state;
  }
}

export function useScreening() {
  const [state, dispatch] = useReducer(screeningReducer, initialState);
  const [availableTools] = useState(SCREENING_TOOLS);

  const selectTool = useCallback((toolId) => {
    dispatch({ type: 'SELECT_TOOL', toolId });
  }, []);

  const answerQuestion = useCallback((questionId, answer) => {
    dispatch({ type: 'ANSWER_QUESTION', questionId, answer });
  }, []);

  const nextStep = useCallback(() => {
    dispatch({ type: 'NEXT_STEP' });
  }, []);

  const prevStep = useCallback(() => {
    dispatch({ type: 'PREV_STEP' });
  }, []);

  const submitScreening = useCallback(async (patientId) => {
    dispatch({ type: 'SUBMIT_START' });
    try {
      const payload = {
        patient_id: patientId,
        tool_id: state.activeToolId,
        responses: state.responses,
        submitted_at: new Date().toISOString(),
      };

      let result;
      try {
        result = await screeningApi.submit(payload);
      } catch {
        // Fallback to mock result when backend is unavailable
        result = {
          sessionId: `sess-${Date.now()}`,
          toolId: state.activeToolId,
          score: Math.random() * 100,
          riskLevel: ['low', 'moderate', 'high'][Math.floor(Math.random() * 3)],
          completedAt: new Date().toISOString(),
          mock: true,
        };
      }

      dispatch({ type: 'SUBMIT_SUCCESS', result });
      return result;
    } catch (err) {
      dispatch({ type: 'SUBMIT_ERROR', error: err.message });
      throw err;
    }
  }, [state.activeToolId, state.responses]);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  const activeTool = availableTools.find((t) => t.id === state.activeToolId);
  const progress = activeTool
    ? Math.round((state.currentStep / activeTool.questions) * 100)
    : 0;

  return {
    ...state,
    availableTools,
    activeTool,
    progress,
    selectTool,
    answerQuestion,
    nextStep,
    prevStep,
    submitScreening,
    reset,
  };
}
