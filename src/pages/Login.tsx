import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../hooks/useAuth'
import Header from '../components/Header'
import styles from './Login.module.css'

export default function Login() {
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleLogin = async () => {
    const trimmed = token.trim()
    if (!trimmed) return
    setLoading(true)
    setError('')
    try {
      const success = await login(trimmed)
      if (success) {
        navigate('/', { replace: true })
      } else {
        setError('Token 无效，请检查后重试')
      }
    } catch {
      setError('连接失败，请检查网络')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <Header title="登录" showBack />

      <motion.div
        className={styles.container}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        <div className={styles.hero}>
          <div className={styles.logoMark}>V2</div>
          <h2 className={styles.title}>登录 V2EX</h2>
          <p className={styles.subtitle}>使用 Personal Access Token 安全登录</p>
        </div>

        <div className={styles.form}>
          <div className={styles.inputGroup}>
            <label className={styles.label}>Access Token</label>
            <textarea
              className={styles.input}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="粘贴你的 V2EX Personal Access Token..."
              rows={3}
              spellCheck={false}
              autoComplete="off"
            />
          </div>

          {error && (
            <motion.p
              className={styles.error}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {error}
            </motion.p>
          )}

          <button
            className={styles.loginBtn}
            onClick={handleLogin}
            disabled={!token.trim() || loading}
          >
            {loading ? (
              <div className={styles.spinner} />
            ) : (
              '登录'
            )}
          </button>
        </div>

        <div className={styles.help}>
          <h3>如何获取 Token？</h3>
          <ol>
            <li>访问 <a href="https://www.v2ex.com/settings/tokens" target="_blank" rel="noopener noreferrer">V2EX Token 设置</a></li>
            <li>点击「创建新 Token」</li>
            <li>勾选所有需要的权限</li>
            <li>复制生成的 Token 粘贴到上方</li>
          </ol>
          <p className={styles.helpNote}>
            Token 仅存储在你的浏览器本地，不会上传到任何第三方服务器。
          </p>
        </div>
      </motion.div>
    </div>
  )
}
