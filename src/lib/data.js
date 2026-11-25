// Picks the data source. Built with VITE_API_URL: the Node API. Without it: the browser test version.
import * as demo from './store.js'
import * as api from './api.js'

const impl = import.meta.env.VITE_API_URL ? api : demo

export const IS_DEMO = !import.meta.env.VITE_API_URL
export const getSettings = (...a) => impl.getSettings(...a)
export const saveSettings = (...a) => impl.saveSettings(...a)
export const listEvents = (...a) => impl.listEvents(...a)
export const getEvent = (...a) => impl.getEvent(...a)
export const saveEvent = (...a) => impl.saveEvent(...a)
export const deleteEvent = (...a) => impl.deleteEvent(...a)
export const createBooking = (...a) => impl.createBooking(...a)
export const getBooking = (...a) => impl.getBooking(...a)
export const findBooking = (...a) => impl.findBooking(...a)
export const completePayment = (...a) => impl.completePayment(...a)
export const listBookings = (...a) => impl.listBookings(...a)
export const addInterest = (...a) => impl.addInterest(...a)
export const listInterest = (...a) => impl.listInterest(...a)
export const resetDemo = (...a) => impl.resetDemo(...a)
export const login = (...a) => impl.login(...a)
export const currentUser = (...a) => impl.currentUser(...a)
export const logout = (...a) => impl.logout(...a)
export const DEMO_USERS = impl.DEMO_USERS
