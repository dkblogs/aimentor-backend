const supabase = require('./supabaseClient');

class MemoryService {
  async saveToHistory(userId, message, response) {
    const { error } = await supabase
      .from('chat_history')
      .insert({ user_id: userId, message, response });
    if (error) console.error('Save history error:', error.code, error.message);
  }

  async getHistory(userId) {
    const { data, error } = await supabase
      .from('chat_history')
      .select('id, message, response, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(50);
    if (error) {
      console.error('Get history error:', error.message);
      return [];
    }
    return data || [];
  }

  async getContext(userId, query) {
    const history = await this.getHistory(userId);
    return history
      .slice(-5)
      .map(h => `User: ${h.message}\nMentor: ${h.response}`)
      .join('\n\n');
  }

  async updateProfile(userId, profileData) {
    const { error } = await supabase
      .from('student_profiles')
      .upsert({ user_id: userId, ...profileData, last_session: new Date().toISOString() });
    if (error) console.error('Update profile error:', error.message);
  }

  async getProfile(userId) {
    const { data, error } = await supabase
      .from('student_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();
    if (error && error.code !== 'PGRST116') {
      console.error('Get profile error:', error.message);
    }
    return data || null;
  }

  async saveQuizScore(userId, subject, difficulty, correct, total) {
    const { error } = await supabase
      .from('quiz_scores')
      .insert({ user_id: userId, subject, difficulty, score: correct, total });
    if (error) {
      console.error('Save score error:', error.code, error.message);
      throw error; // surface to route so we can return a real error response
    }
  }

  async getQuizScores(userId) {
    const { data, error } = await supabase
      .from('quiz_scores')
      .select('id, subject, difficulty, score, total, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) {
      console.error('Get scores error:', error.message);
      return [];
    }
    return data || [];
  }
}

module.exports = new MemoryService();
