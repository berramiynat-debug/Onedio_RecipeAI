import { Request, Response } from 'express';
import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import pool from '../database/db';

export const authController = {
  async register(req: Request, res: Response) {
    try {
      const { username, email, password } = req.body;

      if (!username || username.trim().length < 3) {
        return res.status(400).json({ error: 'Kullanıcı adı en az 3 karakter olmalıdır.' });
      }
      
      const usernameRegex = /^[a-zA-Z0-9çğışöüÇĞİŞÖÜ\s_-]{3,50}$/u;
      if (!usernameRegex.test(username.trim())) {
        return res.status(400).json({ error: 'Kullanıcı adı yalnızca harf, rakam, boşluk ve alt çizgi içerebilir.' });
      }
      
      if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
        return res.status(400).json({ error: 'Geçerli bir e-posta adresi giriniz.' });
      }

      if (!password || password.length < 6) {
        return res.status(400).json({ error: 'Şifre en az 6 karakter olmalıdır.' });
      }

      // Kullanıcı adı benzersiz olmalı
      const [existingUsername] = await pool.query('SELECT id FROM users WHERE username = ?', [username.trim()]) as any;
      if (existingUsername.length > 0) {
        return res.status(400).json({ error: 'Bu kullanıcı adı zaten alınmış.' });
      }

      // E-posta benzersiz olmalı
      const [existingEmail] = await pool.query('SELECT id FROM users WHERE email = ?', [email.trim()]) as any;
      if (existingEmail.length > 0) {
        return res.status(400).json({ error: 'Bu e-posta adresi zaten kullanılıyor.' });
      }

      const hashedPassword = await bcryptjs.hash(password, 10);

      const [result] = await pool.query(
        'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
        [username.trim(), email.trim(), hashedPassword]
      ) as any;

      const newUserId = result.insertId;

      const token = jwt.sign(
        { 
          id: newUserId, 
          email: email.trim(), 
          username: username.trim() 
        }, 
        config.jwtSecret, 
        { expiresIn: '24h' }
      );

      res.status(201).json({ 
        message: 'Kayıt başarılı.',
        token,
        user: {
          id: newUserId,
          email: email.trim(),
          username: username.trim()
        }
      });
    } catch (error) {
      console.error('Kayıt hatası:', error);
      res.status(500).json({ error: 'Sunucu hatası.' });
    }
  },

  async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'E-posta ve şifre gereklidir.' });
      }

      const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]) as any;
      if (users.length === 0) {
        return res.status(401).json({ error: 'Geçersiz e-posta veya şifre.' });
      }

      const user = users[0];
      
      // Legacy user handling (if no password_hash)
      if (!user.password_hash) {
         return res.status(401).json({ error: 'Eski hesap. Lütfen yöneticiye başvurun veya yeni hesap açın.' });
      }

      const isMatch = await bcryptjs.compare(password, user.password_hash);
      if (!isMatch) {
        return res.status(401).json({ error: 'Geçersiz e-posta veya şifre.' });
      }

      const token = jwt.sign(
        { 
          id: user.id, 
          email: user.email, 
          username: user.username || user.email.split('@')[0] 
        }, 
        config.jwtSecret, 
        { expiresIn: '24h' }
      );

      res.json({ 
        token, 
        user: { 
          id: user.id, 
          email: user.email, 
          username: user.username || user.email.split('@')[0] 
        } 
      });
    } catch (error) {
      console.error('Giriş hatası:', error);
      res.status(500).json({ error: 'Sunucu hatası.' });
    }
  },

  async getProfile(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const [users] = await pool.query('SELECT id, username, email, created_at FROM users WHERE id = ?', [userId]) as any;
      if (users.length === 0) {
        return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
      }
      res.json(users[0]);
    } catch (error) {
      console.error('Profil getirme hatası:', error);
      res.status(500).json({ error: 'Sunucu hatası.' });
    }
  },

  async updateProfile(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { username, password } = req.body;

      const [users] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]) as any;
      if (users.length === 0) {
        return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
      }

      const user = users[0];
      let queryParts: string[] = [];
      let queryParams: any[] = [];

      if (username !== undefined) {
        const trimmedUsername = username.trim();
        if (trimmedUsername.length < 3) {
          return res.status(400).json({ error: 'Kullanıcı adı en az 3 karakter olmalıdır.' });
        }
        const usernameRegex = /^[a-zA-Z0-9çğışöüÇĞİŞÖÜ\s_-]{3,50}$/u;
        if (!usernameRegex.test(trimmedUsername)) {
          return res.status(400).json({ error: 'Kullanıcı adı yalnızca harf, rakam, boşluk ve alt çizgi içerebilir.' });
        }
        // Benzersizlik kontrolü (başka bir kullanıcı almış mı?)
        const [existingUsername] = await pool.query('SELECT id FROM users WHERE username = ? AND id != ?', [trimmedUsername, userId]) as any;
        if (existingUsername.length > 0) {
          return res.status(400).json({ error: 'Bu kullanıcı adı zaten alınmış.' });
        }
        queryParts.push('username = ?');
        queryParams.push(trimmedUsername);
      }

      if (password !== undefined && password !== '') {
        if (password.length < 6) {
          return res.status(400).json({ error: 'Şifre en az 6 karakter olmalıdır.' });
        }
        const hashedPassword = await bcryptjs.hash(password, 10);
        queryParts.push('password_hash = ?');
        queryParams.push(hashedPassword);
      }

      if (queryParts.length === 0) {
        return res.status(400).json({ error: 'Güncellenecek alan gönderilmedi.' });
      }

      queryParams.push(userId);
      await pool.query(
        `UPDATE users SET ${queryParts.join(', ')} WHERE id = ?`,
        queryParams
      );

      // Güncel bilgileri çek
      const [updatedUsers] = await pool.query('SELECT id, username, email, created_at FROM users WHERE id = ?', [userId]) as any;
      const updatedUser = updatedUsers[0];

      // Yeni JWT Token üret (Kullanıcı adının anlık yansıması için)
      const token = jwt.sign(
        { 
          id: updatedUser.id, 
          email: updatedUser.email, 
          username: updatedUser.username || updatedUser.email.split('@')[0] 
        }, 
        config.jwtSecret, 
        { expiresIn: '24h' }
      );

      res.json({
        message: 'Profil başarıyla güncellendi.',
        token,
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          username: updatedUser.username || updatedUser.email.split('@')[0]
        }
      });
    } catch (error) {
      console.error('Profil güncelleme hatası:', error);
      res.status(500).json({ error: 'Sunucu hatası.' });
    }
  }
};
