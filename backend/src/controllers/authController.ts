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

      await pool.query(
        'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
        [username.trim(), email.trim(), hashedPassword]
      );

      res.status(201).json({ message: 'Kayıt başarılı, giriş yapabilirsiniz.' });
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
  }
};
