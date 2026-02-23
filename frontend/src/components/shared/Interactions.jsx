import React, { useState, useEffect } from 'react';
import { interactionAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { MessageSquare, Send, ThumbsUp, Trash2, Reply, Smile } from 'lucide-react';

export default function Interactions({ entityType, entityId }) {
    const { user } = useAuth();
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState('');
    const [replyTo, setReplyTo] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchComments();
    }, [entityType, entityId]);

    const fetchComments = async () => {
        try {
            const { data } = await interactionAPI.get(entityType, entityId);
            setComments(data);
        } catch (error) {
            console.error('Error fetching comments:', error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!newComment.trim()) return;

        try {
            setLoading(true);
            await interactionAPI.create({
                entity_type: entityType,
                entity_id: entityId,
                content: newComment,
                parent_id: replyTo?._id || replyTo?.id || null
            });
            setNewComment('');
            setReplyTo(null);
            await fetchComments();
        } catch (error) {
            console.error('Error posting comment:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleReact = async (commentId, emoji) => {
        try {
            await interactionAPI.react(commentId, emoji);
            await fetchComments();
        } catch (error) {
            console.error('Error reacting:', error);
        }
    };

    const handleDelete = async (commentId) => {
        if (!window.confirm('Delete this comment?')) return;
        try {
            await interactionAPI.delete(commentId);
            await fetchComments();
        } catch (error) {
            console.error('Error deleting comment:', error);
        }
    };

    const CommentItem = ({ item, isReply = false }) => (
        <div className={`flex gap-4 ${isReply ? 'ml-12 mt-4' : 'mt-6'} animate-in fade-in slide-in-from-left-2 duration-300`}>
            <div className="shrink-0 w-10 h-10 rounded-full bg-maroon/5 flex items-center justify-center overflow-hidden border border-maroon/10">
                {item.user_photo ? (
                    <img src={item.user_photo} alt="" className="w-full h-full object-cover" />
                ) : (
                    <div className="text-maroon font-black uppercase text-xs">
                        {item.user_name?.substring(0, 2)}
                    </div>
                )}
            </div>
            <div className="flex-1">
                <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 relative group">
                    <div className="flex justify-between items-start mb-1">
                        <div>
                            <span className="text-xs font-black text-maroon uppercase tracking-widest">{item.user_name}</span>
                            <span className={`ml-2 px-2 py-0.5 text-[8px] font-black rounded uppercase tracking-tighter ${item.role === 'student' ? 'bg-blue-100 text-blue-700' : 'bg-gold/20 text-maroon'}`}>
                                {item.role}
                            </span>
                        </div>
                        <span className="text-[10px] text-gray-400 font-bold">{new Date(item.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="text-sm text-gray-700 font-medium leading-relaxed">{item.content}</p>

                    {/* Actions */}
                    <div className="mt-3 flex items-center gap-4">
                        <button
                            onClick={() => handleReact(item._id || item.id, '👍')}
                            className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest transition-colors ${Array.isArray(item.reactions?.['👍']) && item.reactions['👍'].includes(user?.id)
                                    ? 'text-blue-600' : 'text-gray-400 hover:text-maroon'
                                }`}
                        >
                            <ThumbsUp className="w-3 h-3" />
                            {Array.isArray(item.reactions?.['👍']) ? item.reactions['👍'].length : 0}
                        </button>
                        {!isReply && (
                            <button
                                onClick={() => setReplyTo(item)}
                                className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-maroon transition-colors"
                            >
                                <Reply className="w-3 h-3" /> Reply
                            </button>
                        )}
                        {(item.user_id === user?.id || ['admin', 'superadmin'].includes(user?.role)) && (
                            <button
                                onClick={() => handleDelete(item._id || item.id)}
                                className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-red-600 transition-colors"
                            >
                                <Trash2 className="w-3 h-3" /> Delete
                            </button>
                        )}
                    </div>
                </div>

                {/* Replies */}
                {Array.isArray(item.replies) && item.replies.map(reply => (
                    <CommentItem key={reply._id || reply.id} item={reply} isReply={true} />
                ))}
            </div>
        </div>
    );

    return (
        <div className="mt-12 pt-12 border-t border-maroon/5">
            <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-maroon rounded-2xl shadow-lg shadow-maroon/20">
                    <MessageSquare className="w-5 h-5 text-gold" />
                </div>
                <div>
                    <h3 className="text-xl font-black text-maroon uppercase tracking-tight">Academic Discourse</h3>
                    <p className="text-[10px] text-maroon/40 font-bold uppercase tracking-[0.3em] mt-0.5 italic">Community Engagement Portal</p>
                </div>
            </div>

            {/* Input Area */}
            <form onSubmit={handleSubmit} className="mb-10 relative">
                {replyTo && (
                    <div className="absolute -top-8 left-4 flex items-center gap-2 text-[10px] font-black text-maroon/40 uppercase tracking-widest bg-white px-2">
                        Replying to <span className="text-maroon">{replyTo.user_name}</span>
                        <button onClick={() => setReplyTo(null)} className="text-red-500 hover:underline">Cancel</button>
                    </div>
                )}
                <div className="relative group">
                    <textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder={user?.role === 'student' ? "Share your feedback or ask a question..." : "Post a response or academic remark..."}
                        className="w-full bg-gray-50 border border-gray-100 rounded-[2rem] px-8 py-6 text-sm font-medium text-gray-700 outline-none focus:ring-4 focus:ring-maroon/5 focus:bg-white transition-all min-h-[120px] shadow-inner"
                    />
                    <button
                        type="submit"
                        disabled={loading || !newComment.trim()}
                        className="absolute bottom-4 right-4 bg-maroon text-gold px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl hover:bg-elite-maroon transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                        {loading ? 'Transmitting...' : (
                            <>
                                <Send className="w-3 h-3" />
                                {replyTo ? 'Post Response' : 'Initiate Discussion'}
                            </>
                        )}
                    </button>
                </div>
            </form>

            {/* Comments List */}
            <div className="space-y-4 max-h-[600px] overflow-y-auto custom-scrollbar pr-4">
                {comments.length > 0 ? (
                    comments.map(comment => <CommentItem key={comment._id || comment.id} item={comment} />)
                ) : (
                    <div className="py-20 text-center bg-gray-50 rounded-[3rem] border border-dashed border-gray-200">
                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                            <MessageSquare className="w-8 h-8 text-black/10" />
                        </div>
                        <p className="text-[10px] font-black text-black/20 uppercase tracking-[0.3em]">No academic discourse recorded for this module yet.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
