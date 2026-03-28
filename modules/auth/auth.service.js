const jwt         = require('jsonwebtoken')
const User        = require('../users/user.model')
const userService = require('../users/user.service')

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '30d'
  })
}

const authService = {

  register: async (data) => {
    const { name, phoneNumber, pin, subjects } = data

    if (!name || !phoneNumber || !pin) {
      throw { status: 400, message: 'Name, phone number and PIN are required' }
    }

    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      throw { status: 400, message: 'PIN must be exactly 4 digits' }
    }

    const user  = await userService.createUser({ name, phoneNumber, pin, subjects })
    const token = generateToken(user._id)

    return {
      token,
      user: {
        _id:         user._id,
        name:        user.name,
        phoneNumber: user.phoneNumber,
        role:        user.role,
        subjects:    user.subjects
      }
    }
  },

  login: async (phoneNumber, pin) => {
    if (!phoneNumber || !pin) {
      throw { status: 400, message: 'Phone number and PIN are required' }
    }

    // explicitly select pin since it's select: false on the model
    const user = await User.findOne({ phoneNumber }).select('+pin')
    if (!user) throw { status: 401, message: 'Invalid phone number or PIN' }

    const isMatch = await user.matchPin(pin)
    if (!isMatch) throw { status: 401, message: 'Invalid phone number or PIN' }

    await userService.updateLastActive(user._id)

    const token = generateToken(user._id)

    return {
      token,
      user: {
        _id:         user._id,
        name:        user.name,
        phoneNumber: user.phoneNumber,
        role:        user.role,
        subjects:    user.subjects
      }
    }
  },

  registerAdmin: async (data) => {
    const { name, phoneNumber, pin, adminSecretKey } = data

    if (adminSecretKey !== process.env.ADMIN_SECRET_KEY) {
      throw { status: 403, message: 'Invalid admin secret key' }
    }

    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      throw { status: 400, message: 'PIN must be exactly 4 digits' }
    }

    const user  = await userService.createUser({ name, phoneNumber, pin, role: 'admin' })
    const token = generateToken(user._id)

    return {
      token,
      user: {
        _id:         user._id,
        name:        user.name,
        phoneNumber: user.phoneNumber,
        role:        user.role
      }
    }
  },

  getMe: async (id) => {
    return await userService.getProfile(id)
  }

}

module.exports = authService