import { getDb, query, run, queryOne } from '../config/database.js';

const isMongo = async () => !!process.env.MONGODB_URI;

export const getInteractions = async (req, res) => {
    try {
        const { entity_type, entity_id } = req.query;
        if (!entity_type || !entity_id) {
            return res.status(400).json({ error: 'entity_type and entity_id are required' });
        }

        if (await isMongo()) {
            const Interaction = (await import('../models/mongo/Interaction.js')).default;
            const interactions = await Interaction.find({ entity_type, entity_id, parent_id: null })
                .sort({ created_at: -1 });

            // Fetch replies for these interactions
            const results = await Promise.all(interactions.map(async (inter) => {
                const replies = await Interaction.find({ parent_id: inter._id }).sort({ created_at: 1 });
                return { ...inter.toObject(), replies };
            }));

            return res.json(results);
        }

        // SQL Implementation
        const interactions = await query(
            'SELECT * FROM interactions WHERE entity_type = ? AND entity_id = ? AND parent_id IS NULL ORDER BY created_at DESC',
            [entity_type, entity_id]
        );

        const results = await Promise.all(interactions.map(async (inter) => {
            const replies = await query(
                'SELECT * FROM interactions WHERE parent_id = ? ORDER BY created_at ASC',
                [inter.id]
            );
            return {
                ...inter,
                reactions: inter.reactions ? JSON.parse(inter.reactions) : {},
                replies: replies.map(r => ({ ...r, reactions: r.reactions ? JSON.parse(r.reactions) : {} }))
            };
        }));

        res.json(results);
    } catch (error) {
        console.error('Error fetching interactions:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const createInteraction = async (req, res) => {
    try {
        const { entity_type, entity_id, content, parent_id } = req.body;
        const { id, role, email } = req.user;

        if (!entity_type || !entity_id || !content) {
            return res.status(400).json({ error: 'entity_type, entity_id, and content are required' });
        }

        let name = req.user.name || req.user.email.split('@')[0];
        let photo = null;

        const mongo = await isMongo();
        if (mongo) {
            const User = (await import('../models/mongo/User.js')).default;
            const user = await User.findById(id).select('photo');
            if (user) {
                photo = user.photo;
            }
        } else {
            const user = await queryOne('SELECT photo FROM users WHERE id = ?', [id]);
            if (user) {
                photo = user.photo;
            }
        }

        if (mongo) {
            const Interaction = (await import('../models/mongo/Interaction.js')).default;
            const newInteraction = new Interaction({
                entity_type,
                entity_id,
                user_id: id,
                user_name: name,
                user_photo: photo,
                role,
                content,
                parent_id: parent_id || null
            });
            const saved = await newInteraction.save();
            return res.status(201).json(saved);
        }

        // SQL Implementation
        const result = await run(
            'INSERT INTO interactions (entity_type, entity_id, user_id, user_name, user_photo, role, content, parent_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [entity_type, entity_id, id, name, photo, role, content, parent_id || null]
        );
        const inter = await queryOne('SELECT * FROM interactions WHERE id = ?', [result.lastID]);
        res.status(201).json({ ...inter, reactions: {} });
    } catch (error) {
        console.error('Error creating interaction:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const toggleReaction = async (req, res) => {
    try {
        const { id } = req.params;
        const { emoji } = req.body;
        const userId = req.user.id;

        if (!emoji) return res.status(400).json({ error: 'Emoji is required' });

        if (await isMongo()) {
            const Interaction = (await import('../models/mongo/Interaction.js')).default;
            const interaction = await Interaction.findById(id);
            if (!interaction) return res.status(404).json({ error: 'Interaction not found' });

            const reactions = interaction.reactions || new Map();
            const currentUsers = reactions.get(emoji) || [];

            if (currentUsers.includes(userId)) {
                reactions.set(emoji, currentUsers.filter(u => u !== userId));
            } else {
                reactions.set(emoji, [...currentUsers, userId]);
            }

            interaction.reactions = reactions;
            await interaction.save();
            return res.json(interaction);
        }

        // SQL Implementation
        const interaction = await queryOne('SELECT * FROM interactions WHERE id = ?', [id]);
        if (!interaction) return res.status(404).json({ error: 'Interaction not found' });

        let reactions = interaction.reactions ? JSON.parse(interaction.reactions) : {};
        let currentUsers = reactions[emoji] || [];

        if (currentUsers.includes(userId)) {
            reactions[emoji] = currentUsers.filter(u => u !== userId);
        } else {
            reactions[emoji] = [...currentUsers, userId];
        }

        await run('UPDATE interactions SET reactions = ? WHERE id = ?', [JSON.stringify(reactions), id]);
        res.json({ ...interaction, reactions });
    } catch (error) {
        console.error('Error toggling reaction:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const deleteInteraction = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const role = req.user.role;

        if (await isMongo()) {
            const Interaction = (await import('../models/mongo/Interaction.js')).default;
            const inter = await Interaction.findById(id);
            if (!inter) return res.status(404).json({ error: 'Interaction not found' });

            // Only author or admin/superadmin can delete
            if (inter.user_id !== userId && !['admin', 'superadmin'].includes(role)) {
                return res.status(403).json({ error: 'Unauthorized' });
            }

            await Interaction.findByIdAndDelete(id);
            // Also delete replies
            await Interaction.deleteMany({ parent_id: id });
            return res.json({ message: 'Deleted successfully' });
        }

        const inter = await queryOne('SELECT * FROM interactions WHERE id = ?', [id]);
        if (!inter) return res.status(404).json({ error: 'Interaction not found' });

        if (inter.user_id !== userId && !['admin', 'superadmin'].includes(role)) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        await run('DELETE FROM interactions WHERE id = ?', [id]);
        await run('DELETE FROM interactions WHERE parent_id = ?', [id]);
        res.json({ message: 'Deleted successfully' });
    } catch (error) {
        console.error('Error deleting interaction:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
