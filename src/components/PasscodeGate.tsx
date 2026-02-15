import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react'
import styles from './PasscodeGate.module.css'

const DIGIT_COUNT = 6

export default function PasscodeGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'locked' | 'unlocked'>('loading')
  const [digits, setDigits] = useState<string[]>(Array(DIGIT_COUNT).fill(''))
  const [error, setError] = useState('')
  const [shaking, setShaking] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    fetch('/auth/passcode-status')
      .then(r => r.json())
      .then(data => setStatus(data.verified ? 'unlocked' : 'locked'))
      .catch(() => setStatus('locked'))
  }, [])

  const submit = useCallback(async (code: string) => {
    try {
      const res = await fetch('/auth/verify-passcode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: code }),
      })
      if (res.ok) {
        setStatus('unlocked')
      } else {
        setError('口令错误')
        setShaking(true)
        setTimeout(() => {
          setShaking(false)
          setDigits(Array(DIGIT_COUNT).fill(''))
          inputRefs.current[0]?.focus()
        }, 400)
      }
    } catch {
      setError('网络错误，请重试')
      setShaking(true)
      setTimeout(() => setShaking(false), 400)
    }
  }, [])

  const handleChange = useCallback((index: number, value: string) => {
    // Only allow single digit
    const digit = value.replace(/\D/g, '').slice(-1)
    setError('')
    setDigits(prev => {
      const next = [...prev]
      next[index] = digit
      // Auto-submit when all filled
      if (digit && next.every(d => d)) {
        setTimeout(() => submit(next.join('')), 0)
      }
      return next
    })
    // Move to next input
    if (digit && index < DIGIT_COUNT - 1) {
      inputRefs.current[index + 1]?.focus()
    }
  }, [submit])

  const handleKeyDown = useCallback((index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }, [digits])

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, DIGIT_COUNT)
    if (!pasted) return
    const next = Array(DIGIT_COUNT).fill('')
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i]
    setDigits(next)
    setError('')
    if (pasted.length === DIGIT_COUNT) {
      setTimeout(() => submit(pasted), 0)
    } else {
      inputRefs.current[pasted.length]?.focus()
    }
  }, [submit])

  if (status === 'loading') {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
      </div>
    )
  }

  if (status === 'unlocked') {
    return <>{children}</>
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.card}>
        <div className={styles.logoMark}>V2</div>
        <div className={styles.title}>请输入访问口令</div>
        <div
          className={`${styles.digits} ${error ? styles.error : ''} ${shaking ? styles.shake : ''}`}
        >
          {digits.map((d, i) => (
            <input
              key={i}
              ref={el => { inputRefs.current[i] = el }}
              className={styles.digitInput}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={1}
              autoComplete="off"
              value={d}
              autoFocus={i === 0}
              onChange={e => handleChange(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              onPaste={i === 0 ? handlePaste : undefined}
            />
          ))}
        </div>
        <div className={styles.errorMsg}>{error}</div>
      </div>
    </div>
  )
}
