const collection = require('../models/user');

const trackActivity = async (req, res, next) => {
    try {
        if (req.user && req.user.id) {
            await collection.findByIdAndUpdate(req.user.id, {
                lastActive: new Date()
            });
        }
        next();
    } catch (error) {
        console.error('Error tracking activity:', error);
        next();
    }
};

module.exports = trackActivity;
