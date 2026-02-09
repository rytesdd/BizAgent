/**
 * TodoCard - Action Items Card
 * 
 * Purpose: Action items in Kanban style.
 * Props: { task, assignee, deadline, priority, status }
 * 
 * UI Layout:
 * - Style: Kanban card look with bg-zinc-800
 * - Top Row: priority Badge + status
 * - Middle: task (Medium font weight)
 * - Bottom: Calendar Icon + deadline | User Icon + assignee
 * - Interaction: Mark Done button on the right
 */

import React, { useState } from 'react';
import { Calendar, User, ChevronRight, Check, Circle, Clock } from 'lucide-react';

/**
 * Priority badge configuration
 */
const getPriorityConfig = (priority) => {
    const normalized = String(priority || '').toLowerCase();

    // P0 - Critical
    if (/^p0$|critical|紧急|最高/.test(normalized)) {
        return {
            label: 'P0',
            className: 'bg-red-500 text-white',
            solid: true
        };
    }

    // P1 - High
    if (/^p1$|high|高/.test(normalized)) {
        return {
            label: 'P1',
            className: 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
            solid: false
        };
    }

    // P2 - Medium
    if (/^p2$|medium|中/.test(normalized)) {
        return {
            label: 'P2',
            className: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
            solid: false
        };
    }

    // P3 - Low
    return {
        label: priority ? String(priority).toUpperCase() : 'P3',
        className: 'bg-zinc-700/50 text-zinc-400 border border-zinc-600/30',
        solid: false
    };
};

/**
 * Status display configuration
 */
const getStatusConfig = (status) => {
    const normalized = String(status || '').toLowerCase();

    if (/done|完成|finished/.test(normalized)) {
        return { label: status || 'Done', color: 'text-emerald-400' };
    }

    if (/progress|进行|doing/.test(normalized)) {
        return { label: status || 'In Progress', color: 'text-blue-400' };
    }

    if (/blocked|阻塞|stuck/.test(normalized)) {
        return { label: status || 'Blocked', color: 'text-red-400' };
    }

    return { label: status || 'Todo', color: 'text-zinc-400' };
};

/**
 * @param {Object} props
 * @param {Object} props.data - Todo data
 * @param {Function} [props.onMarkDone] - Callback when Mark Done is clicked
 */
const TodoCard = ({ data, onMarkDone }) => {
    const [isHovered, setIsHovered] = useState(false);

    if (!data) return null;

    const { task, assignee, deadline, priority, status } = data;
    const priorityConfig = getPriorityConfig(priority);
    const statusConfig = getStatusConfig(status);
    const isDone = /done|完成|finished/.test(String(status || '').toLowerCase());

    const handleMarkDone = (e) => {
        e.stopPropagation();
        if (onMarkDone) {
            onMarkDone(data);
        } else {
            console.log('[TodoCard] Mark Done clicked:', task);
        }
    };

    return (
        <div
            className={`
                w-full rounded-xl bg-zinc-800 border border-white/10 overflow-hidden
                transition-all duration-200 ease-out
                hover:border-zinc-600/80 hover:shadow-lg hover:shadow-black/20
                ${isDone ? 'opacity-70' : ''}
            `}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div className="p-4">
                {/* Top Row: Priority + Status */}
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        {/* Priority Badge */}
                        <span className={`
                            text-[10px] font-bold px-2 py-0.5 rounded
                            ${priorityConfig.className}
                        `}>
                            {priorityConfig.label}
                        </span>

                        {/* Status */}
                        <span className={`text-xs ${statusConfig.color}`}>
                            {statusConfig.label}
                        </span>
                    </div>

                    {/* Mark Done Button (appears on hover or always for mobile) */}
                    <button
                        onClick={handleMarkDone}
                        className={`
                            flex items-center gap-1 
                            text-xs px-2 py-1 rounded-md
                            transition-all duration-200
                            ${isDone
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : isHovered
                                    ? 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                                    : 'bg-transparent text-transparent'
                            }
                        `}
                        disabled={isDone}
                    >
                        {isDone ? (
                            <>
                                <Check className="w-3 h-3" />
                                <span>Done</span>
                            </>
                        ) : (
                            <>
                                <Circle className="w-3 h-3" />
                                <span>Mark Done</span>
                            </>
                        )}
                    </button>
                </div>

                {/* Middle: Task Description */}
                <p className={`
                    text-sm font-medium text-zinc-100 mb-3 leading-relaxed
                    ${isDone ? 'line-through text-zinc-500' : ''}
                `}>
                    {task || 'Untitled Task'}
                </p>

                {/* Bottom: Deadline + Assignee */}
                <div className="flex items-center gap-4 text-xs text-zinc-500">
                    {/* Deadline */}
                    {deadline && (
                        <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5" />
                            <span>{deadline}</span>
                        </div>
                    )}

                    {/* Separator */}
                    {deadline && assignee && (
                        <span className="text-zinc-700">|</span>
                    )}

                    {/* Assignee */}
                    {assignee && (
                        <div className="flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5" />
                            <span>{assignee}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TodoCard;
