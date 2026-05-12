import React, { useRef, useEffect, useState } from 'react';
import { Bold, Underline, ListOrdered, Type } from 'lucide-react';

/**
 * A premium Rich Text Editor component for reporting.
 * Supports Bold, Underline, Numbered Lists, and multi-line input.
 */
const RichTextEditor = ({ value, onChange, placeholder, className, minHeight = '120px' }) => {
    const editorRef = useRef(null);
    const lastValueRef = useRef(undefined); // Initialize to undefined to ensure sync on mount
    const [isFocused, setIsFocused] = useState(false);

    // Sync external value to editor only if it changed externally
    useEffect(() => {
        if (editorRef.current && value !== lastValueRef.current) {
            editorRef.current.innerHTML = value || '';
            lastValueRef.current = value;
        }
    }, [value]);

    const handleInput = () => {
        if (editorRef.current) {
            const newValue = editorRef.current.innerHTML;
            lastValueRef.current = newValue;
            onChange(newValue);
        }
    };

    const execCommand = (command, value = null) => {
        document.execCommand(command, false, value);
        editorRef.current?.focus();
        handleInput();
    };

    const handleKeyDown = (e) => {
        // Prevent form submission on Enter
        if (e.key === 'Enter') {
            // In contentEditable, Enter naturally creates a new line (usually a <div> or <br>)
            // We don't need to do anything special here to "move to next line"
            // but we want to make sure it doesn't trigger any parent form submission.
            e.stopPropagation();
        }
    };

    return (
        <div className={`flex flex-col rounded-2xl border transition-all duration-300 ${isFocused ? 'ring-4 ring-maroon/5 border-maroon' : 'border-gray-200'} ${className}`}>
            {/* Toolbar */}
            <div className="flex items-center gap-1 p-2 border-b border-gray-100 bg-gray-50/50 rounded-t-2xl">
                <button
                    type="button"
                    onClick={() => execCommand('bold')}
                    className="p-2 hover:bg-maroon hover:text-gold rounded-lg transition-all text-gray-500"
                    title="Bold"
                >
                    <Bold className="w-3.5 h-3.5" />
                </button>
                <button
                    type="button"
                    onClick={() => execCommand('underline')}
                    className="p-2 hover:bg-maroon hover:text-gold rounded-lg transition-all text-gray-500"
                    title="Underline"
                >
                    <Underline className="w-3.5 h-3.5" />
                </button>
                <div className="w-px h-4 bg-gray-200 mx-1"></div>
                <button
                    type="button"
                    onClick={() => execCommand('insertOrderedList')}
                    className="p-2 hover:bg-maroon hover:text-gold rounded-lg transition-all text-gray-500"
                    title="Numbered List"
                >
                    <ListOrdered className="w-3.5 h-3.5" />
                </button>
                <div className="flex-1"></div>
                <div className="px-3 py-1 bg-white rounded-lg border border-gray-100 text-[8px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5 shadow-sm">
                    <Type className="w-3 h-3" /> Rich Mode
                </div>
            </div>

            {/* Editor Surface */}
            <div
                ref={editorRef}
                contentEditable
                onInput={handleInput}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                className="p-5 text-sm text-gray-700 outline-none min-h-[120px] bg-white rounded-b-2xl rich-text-content custom-scrollbar overflow-y-auto"
                style={{ minHeight }}
            />
            
            {/* Placeholder simulation for contentEditable */}
            {!value && !isFocused && (
                <div className="absolute top-[52px] left-5 text-gray-300 text-sm pointer-events-none italic font-medium">
                    {placeholder}
                </div>
            )}
        </div>
    );
};

export default RichTextEditor;
