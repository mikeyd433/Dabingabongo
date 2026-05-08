import { createContext, useContext } from 'react';

export const FlowContext = createContext(null);
export const useFlowContext = () => useContext(FlowContext);
