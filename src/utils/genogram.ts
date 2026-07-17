import type { RelationEdge } from '../types';
import { RELATION_CATEGORIES } from '../config/relationships';
import { MARRIAGE_DROP_Y } from '../config/constants';

export const generateId = () => Math.random().toString(36).substr(2, 9);
export const findMarriageEdge = (nodeId: string, edges: RelationEdge[]) => edges.find(e => (e.fromId === nodeId || e.toId === nodeId) && RELATION_CATEGORIES["Struttura / Coppia"].includes(e.type));
export const getMarriageBarY = (startY: number, endY: number) => Math.max(startY, endY) + MARRIAGE_DROP_Y;
