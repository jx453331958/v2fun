import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import Header from '../components/Header'
import styles from './Login.module.css'

export default function Login() {
  const [cookie, setCookie] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleLogin = async () => {
    const trimmed = cookie.trim()
    if (!trimmed) return
    setLoading(true)
    setError('')
    const result = await login(trimmed)
    if (result.success) {
      navigate('/', { replace: true })
    } else {
      setError(result.error || 'Cookie 无效，请检查后重试')
    }
    setLoading(false)
  }

  return (
    <div className={styles.page}>
      <Header title="登录" showBack />

      <div className={styles.container}>
        <div className={styles.hero}>
          <div className={styles.logoMark}>V2</div>
          <h2 className={styles.title}>登录 V2EX</h2>
          <p className={styles.subtitle}>使用浏览器 Cookie 登录</p>
        </div>

        <div className={styles.form}>
          <div className={styles.inputGroup}>
            <label className={styles.label}>Cookie</label>
            <textarea
              className={styles.input}
              value={cookie}
              onChange={(e) => setCookie(e.target.value)}
              placeholder="粘贴 V2EX 的 Cookie 字符串..."
              rows={4}
              spellCheck={false}
              autoComplete="off"
            />
          </div>

          {error && (
            <p className={styles.error}>
              {error}
            </p>
          )}

          <button
            className={styles.loginBtn}
            onClick={handleLogin}
            disabled={!cookie.trim() || loading}
          >
            {loading ? (
              <div className={styles.spinner} />
            ) : (
              '登录'
            )}
          </button>
        </div>

        <div className={styles.help}>
          <h3>如何获取 Cookie？</h3>
          <ol>
            <li>在浏览器中登录 <a href="https://www.v2ex.com" target="_blank" rel="noopener noreferrer">V2EX</a></li>
            <li>按 F12 打开开发者工具</li>
            <li>切换到 Network 标签，刷新页面</li>
            <li>点击任意请求，找到 Request Headers 中的 <strong>Cookie</strong></li>
            <li>复制完整的 Cookie 值粘贴到上方</li>
          </ol>
          <p className={styles.helpNote}>
            Cookie 仅存储在服务端本地（AES-256 加密），不会上传到任何第三方服务器。Cookie 过期后需重新获取。
          </p>
        </div>
      </div>
    </div>
  )
}
