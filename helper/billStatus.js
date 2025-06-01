import { theme } from '../constants/theme';

// ✅ Constants cho trạng thái
export const BILL_STATUS = {
  WAITING: 'waiting',           // in_order + on_process
  USING: 'using',              // in_order + visited  
  COMPLETED: 'completed',       // completed
  USER_CANCELLED: 'user_cancelled',    // cancelled + on_process
  SYSTEM_CANCELLED: 'system_cancelled' // cancelled + unvisited
};

// ✅ Main function - get status từ state + visit
export const getBillStatus = (state, visit) => {
  if (state === 'in_order') {
    return visit === 'visited' ? BILL_STATUS.USING : BILL_STATUS.WAITING;
  }
  if (state === 'cancelled') {
    return visit === 'unvisited' ? BILL_STATUS.SYSTEM_CANCELLED : BILL_STATUS.USER_CANCELLED;
  }
  return state === 'completed' ? BILL_STATUS.COMPLETED : BILL_STATUS.WAITING;
};

// ✅ Status config object (tối ưu - all in one)
const STATUS_CONFIG = {
  [BILL_STATUS.WAITING]: {
    text: 'Đang đặt',
    color: theme.colors.primary,
    bgColor: '#f8f9ff',
    borderColor: theme.colors.primary + '30'
  },
  [BILL_STATUS.USING]: {
    text: 'Đang sử dụng',
    color: '#2ed573',
    bgColor: '#f0fff4',
    borderColor: '#90ee90'
  },
  [BILL_STATUS.COMPLETED]: {
    text: 'Hoàn thành',
    color: '#27ae60',
    bgColor: '#f0fff4',
    borderColor: '#90ee90'
  },
  [BILL_STATUS.USER_CANCELLED]: {
    text: 'Đã hủy',
    color: '#e74c3c',
    bgColor: '#fff0f0',
    borderColor: '#ffb3b3'
  },
  [BILL_STATUS.SYSTEM_CANCELLED]: {
    text: 'Không hoàn thành',
    color: '#f39c12',
    bgColor: '#fff8f0',
    borderColor: '#ffd699'
  }
};

// ✅ Get functions - optimized
export const getStatusColor = (state, visit) => {
  const status = getBillStatus(state, visit);
  return STATUS_CONFIG[status]?.color || theme.colors.textLight;
};

export const getStatusText = (state, visit) => {
  const status = getBillStatus(state, visit);
  return STATUS_CONFIG[status]?.text || 'Không xác định';
};

export const getStatusStyle = (state, visit) => {
  const status = getBillStatus(state, visit);
  return STATUS_CONFIG[status] || STATUS_CONFIG[BILL_STATUS.WAITING];
};

// ✅ Helper functions
export const canCancel = (state, visit) => getBillStatus(state, visit) === BILL_STATUS.WAITING;
export const canCheckIn = (state, visit) => getBillStatus(state, visit) === BILL_STATUS.WAITING;
export const isActive = (state, visit) => [BILL_STATUS.WAITING, BILL_STATUS.USING].includes(getBillStatus(state, visit));