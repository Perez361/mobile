import { useState, useEffect, useCallback, createContext, useContext } from 'react'
import { Modal, View, Text, TouchableOpacity, StyleSheet, Pressable } from 'react-native'
import { Colors, FontSize, Spacing, Radius } from '../../constants/theme'

type AlertType = 'info' | 'success' | 'error' | 'confirm'

interface AlertOptions {
  type?: AlertType
  variant?: 'danger'
  title: string
  message?: string
  confirmText?: string
  cancelText?: string
  duration?: number
  onConfirm?: () => void
  onCancel?: () => void
}

interface AlertContextValue {
  alert: AlertOptions | null
  showAlert: (options: AlertOptions) => void
  hideAlert: () => void
}

const AlertContext = createContext<AlertContextValue | null>(null)

export function useAlert() {
  const context = useContext(AlertContext)
  if (!context) throw new Error('useAlert must be used within AlertProvider')
  return context
}

export function AlertProvider({ children }: { children: React.ReactNode }) {
  const [alert, setAlert] = useState<AlertOptions | null>(null)

  const showAlert = useCallback((options: AlertOptions) => {
    setAlert(options)
  }, [])

  const hideAlert = useCallback(() => {
    setAlert(null)
  }, [])

  return (
    <AlertContext.Provider value={{ alert, showAlert, hideAlert }}>
      {children}
      <GlobalAlert />
    </AlertContext.Provider>
  )
}

function GlobalAlert() {
  const { alert, hideAlert } = useAlert()

  useEffect(() => {
    if (alert && (alert.type === 'success' || alert.type === 'error' || alert.type === 'info')) {
      const duration = alert.duration ?? 2500
      const timer = setTimeout(() => {
        hideAlert()
      }, duration)
      return () => clearTimeout(timer)
    }
  }, [alert, hideAlert])

  if (!alert) return null

  const isConfirm = alert.type === 'confirm' || alert.type === undefined
  const isDanger = alert.type === 'error' || alert.variant === 'danger'

  return (
    <Modal transparent visible={!!alert} animationType="fade" onRequestClose={hideAlert}>
      <Pressable style={s.overlay} onPress={hideAlert}>
        <Pressable style={s.container} onPress={(e) => e.stopPropagation()}>
          {alert.type === 'success' && <Text style={s.iconSuccess}>✓</Text>}
          {alert.type === 'error' && <Text style={s.iconError}>✕</Text>}
          
          <Text style={s.title}>{alert.title}</Text>
          {alert.message && <Text style={s.message}>{alert.message}</Text>}
          
          <View style={s.buttons}>
            {isConfirm ? (
              <>
                <TouchableOpacity style={s.cancelBtn} onPress={() => { hideAlert(); alert.onCancel?.() }}>
                  <Text style={s.cancelText}>{alert.cancelText ?? 'Cancel'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.confirmBtn, isDanger && s.confirmBtnDanger]}
                  onPress={() => { hideAlert(); alert.onConfirm?.() }}
                >
                  <Text style={[s.confirmText, isDanger && s.confirmTextDanger]}>
                    {alert.confirmText ?? 'OK'}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity style={s.singleBtn} onPress={() => { hideAlert(); alert.onConfirm?.() }}>
                <Text style={s.singleBtnText}>{alert.confirmText ?? 'OK'}</Text>
              </TouchableOpacity>
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    width: '85%',
    maxWidth: 340,
    alignItems: 'center',
  },
  iconSuccess: {
    fontSize: 40,
    color: Colors.success,
    marginBottom: Spacing.md,
  },
  iconError: {
    fontSize: 40,
    color: Colors.danger,
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  message: {
    fontSize: FontSize.base,
    color: Colors.textMuted,
    marginBottom: Spacing.xl,
    lineHeight: 22,
    textAlign: 'center',
  },
  buttons: {
    flexDirection: 'row',
    gap: Spacing.md,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelText: {
    fontSize: FontSize.base,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  confirmBtn: {
    flex: 1,
    height: 48,
    borderRadius: Radius.md,
    backgroundColor: Colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnDanger: {
    backgroundColor: Colors.danger,
  },
  confirmText: {
    fontSize: FontSize.base,
    fontWeight: '600',
    color: '#fff',
  },
  confirmTextDanger: {
    color: '#fff',
  },
  singleBtn: {
    flex: 1,
    height: 48,
    borderRadius: Radius.md,
    backgroundColor: Colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  singleBtnText: {
    fontSize: FontSize.base,
    fontWeight: '600',
    color: '#fff',
  },
})
