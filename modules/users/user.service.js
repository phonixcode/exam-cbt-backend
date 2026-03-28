const User = require('./user.model')

const userService = {

  findByPhone: async (phoneNumber) => {
    return await User.findOne({ phoneNumber })
  },

  findById: async (id) => {
    const user = await User.findById(id)
    if (!user) throw { status: 404, message: 'User not found' }
    return user
  },

  createUser: async (data) => {
    const exists = await User.findOne({ phoneNumber: data.phoneNumber })
    if (exists) throw { status: 400, message: 'Phone number already registered' }
    return await User.create(data)
  },

  updateLastActive: async (id) => {
    return await User.findByIdAndUpdate(id, { lastActive: Date.now() })
  },

  updateSubjects: async (id, subjects) => {
    const user = await User.findByIdAndUpdate(
      id,
      { subjects },
      { new: true, runValidators: true }
    )
    if (!user) throw { status: 404, message: 'User not found' }
    return user
  },

  getProfile: async (id) => {
    const user = await User.findById(id).select('-pin')
    if (!user) throw { status: 404, message: 'User not found' }
    return user
  },

  listUsers: async (query) => {
    const { paginate, paginateMeta } = require('../../shared/helpers/pagination.helper')
    const { page, limit, skip }      = paginate(query)

    const filter = {}
    if (query.role)   filter.role = query.role
    if (query.search) {
      filter.$or = [
        { name:        { $regex: query.search, $options: 'i' } },
        { phoneNumber: { $regex: query.search, $options: 'i' } }
      ]
    }

    const [data, total] = await Promise.all([
      User.find(filter).select('-pin').skip(skip).limit(limit).sort({ createdAt: -1 }),
      User.countDocuments(filter)
    ])

    return { data, meta: paginateMeta(total, page, limit) }
  }

}

module.exports = userService