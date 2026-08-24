import Offer from '../models/Offer.js';
import Product from '../models/Product.js';
import Category from '../models/Category.js';
import { offerSchema } from '../validators/offerValidator.js';

const PAGE_SIZE_DEFAULT = 2;

const setFlash = (req, type, message) => {
  if (type === 'success') {
    req.session.successMessage = message;
  } else {
    req.session.errorMessage = message;
  }
};

const validateOffer = (body) => {
  const { error, value } = offerSchema.validate(body, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    return {
      errors: error.details.map((detail) => detail.message),
      value,
    };
  }

  return {
    errors: [],
    value,
  };
};

const getActiveProducts = () => {
  return Product.find({
    isDeleted: false,
    status: 'ACTIVE',
  }).sort({ name: 1 });
};

const getActiveCategories = () => {
  return Category.find({
    isDeleted: false,
    isActive: true,
  }).sort({ name: 1 });
};

const renderOfferForm = async ({
  req,
  res,
  mode,
  offer = null,
  formErrors = [],
  statusCode = 200,
}) => {
  const [products, categories] = await Promise.all([
    getActiveProducts(),
    getActiveCategories(),
  ]);

  return res.status(statusCode).render('admin/offer-form', {
    layout: 'layouts/admin-layout',
    title:
      mode === 'edit' ? 'Edit Offer - Veloshop' : 'Create Offer - Veloshop',

    mode,
    offer,
    products,
    categories,
    formErrors,
  });
};

const buildOfferQuery = ({ search, status, type }) => {
  const query = {};

  if (search) {
    query.title = {
      $regex: search,
      $options: 'i',
    };
  }

  switch (status) {
    case 'active':
      query.isDeleted = false;
      query.isActive = true;
      break;

    case 'disabled':
      query.isDeleted = false;
      query.isActive = false;
      break;

    case 'deleted':
      query.isDeleted = true;
      break;

    case 'expired':
      query.expiryDate = {
        $lt: new Date(),
      };
      query.isDeleted = false;
      break;

    case 'upcoming':
      query.startDate = {
        $gt: new Date(),
      };
      query.isDeleted = false;
      break;

    default:
      query.isDeleted = false;
  }

  if (type !== 'all') {
    query.type = type;
  }

  return query;
};

export const getOffers = async (req, res) => {
  try {
    const search = String(req.query.search || '').trim();

    const status = req.query.status || 'all';

    const type = req.query.type || 'all';

    const page = Math.max(Number(req.query.page) || 1, 1);

    const limit = Math.min(Number(req.query.limit) || PAGE_SIZE_DEFAULT, 20);

    const query = buildOfferQuery({
      search,
      status,
      type,
    });

    const [offers, totalOffers] = await Promise.all([
      Offer.find(query)

        .populate('product', 'name')

        .populate('category', 'name')

        .sort({
          createdAt: -1,
        })

        .skip((page - 1) * limit)

        .limit(limit)

        .lean(),

      Offer.countDocuments(query),
    ]);

    const [activeCount, disabledCount, deletedCount, expiredCount] =
      await Promise.all([
        Offer.countDocuments({
          isDeleted: false,
          isActive: true,
        }),

        Offer.countDocuments({
          isDeleted: false,
          isActive: false,
        }),

        Offer.countDocuments({
          isDeleted: true,
        }),

        Offer.countDocuments({
          isDeleted: false,
          expiryDate: {
            $lt: new Date(),
          },
        }),
      ]);

    const formattedOffers = offers.map((offer) => {
      const now = new Date();

      let remainingText = '';

      if (now < new Date(offer.startDate)) {
        const days = Math.ceil(
          (new Date(offer.startDate) - now) / (1000 * 60 * 60 * 24),
        );

        remainingText = `Starts in ${days} days`;
      } else if (now > new Date(offer.expiryDate)) {
        const days = Math.floor(
          (now - new Date(offer.expiryDate)) / (1000 * 60 * 60 * 24),
        );

        remainingText = `Expired ${days} days ago`;
      } else {
        const days = Math.ceil(
          (new Date(offer.expiryDate) - now) / (1000 * 60 * 60 * 24),
        );

        remainingText = `${days} days remaining`;
      }

      return {
        ...offer,
        remainingText,
      };
    });
    const totalPages = Math.ceil(totalOffers / limit);

    res.render('admin/offers', {
      layout: 'layouts/admin-layout',

      title: 'Offer Management - Veloshop',

      offers: formattedOffers,

      filters: {
        search,
        status,
        type,
      },

      pagination: {
        page,
        limit,
        totalPages,
        totalOffers,
      },
      stats: {
        activeCount,
        disabledCount,
        deletedCount,
        expiredCount,
      },
    });
  } catch (error) {
    console.log('Offer list error:', error);

    setFlash(req, 'error', 'Failed to load offers');

    res.redirect('/admin');
  }
};
export const getNewOffer = async (req, res) => {
  return renderOfferForm({
    req,
    res,
    mode: 'create',
    offer: null,
  });
};

export const createOffer = async (req, res) => {
  try {
    const { errors, value } = validateOffer(req.body);

    if (errors.length) {
      return renderOfferForm({
        req,
        res,
        mode: 'create',
        offer: req.body,
        formErrors: errors,
        statusCode: 400,
      });
    }

    if (value.type === 'PRODUCT' && !value.product) {
      return renderOfferForm({
        req,
        res,
        mode: 'create',
        offer: req.body,
        formErrors: ['Please select a product for product offer.'],
        statusCode: 400,
      });
    }

    if (value.type === 'CATEGORY' && !value.category) {
      return renderOfferForm({
        req,
        res,
        mode: 'create',
        offer: req.body,
        formErrors: ['Please select a category for category offer.'],
        statusCode: 400,
      });
    }

    if (new Date(value.startDate) >= new Date(value.expiryDate)) {
      return renderOfferForm({
        req,
        res,
        mode: 'create',
        offer: req.body,
        formErrors: ['Expiry date must be after start date.'],
        statusCode: 400,
      });
    }

    const duplicateQuery = {
      title: value.title,
      isDeleted: false,
    };

    if (value.type === 'PRODUCT') {
      duplicateQuery.product = value.product;
    } else if (value.type === 'CATEGORY') {
      duplicateQuery.category = value.category;
    }

    if (value.type === 'REFERRAL') {
      const existingReferral = await Offer.findOne({
        referralCode: value.referralCode,
        isDeleted: false,
      });
      if (existingReferral) {
        return renderOfferForm({
          req,
          res,
          mode: 'create',
          offer: req.body,
          formErrors: ['An active offer with this referral code already exists.'],
          statusCode: 409,
        });
      }
    }

    const existingOffer = await Offer.findOne(duplicateQuery);

    if (existingOffer) {
      return renderOfferForm({
        req,
        res,
        mode: 'create',
        offer: req.body,
        formErrors: ['An active offer already exists for this item.'],
        statusCode: 409,
      });
    }
    await Offer.create({
      title: value.title,

      type: value.type,

      discountType: value.discountType,

      discountValue: value.discountValue,

      product: value.type === 'PRODUCT' ? value.product : null,

      category: value.type === 'CATEGORY' ? value.category : null,

      referralCode: value.type === 'REFERRAL' ? value.referralCode : undefined,

      startDate: value.startDate,

      expiryDate: value.expiryDate,

      isActive: true,
    });
    setFlash(req, 'success', 'Offer created successfully.');

    res.redirect('/admin/offers');
  } catch (error) {
    console.error('Create offer error:', error);

    let errorMsg = 'Failed to create offer.';
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0];
      errorMsg = `An offer with this ${field} already exists.`;
    }

    return renderOfferForm({
      req,
      res,
      mode: 'create',
      offer: req.body,
      formErrors: [errorMsg],
      statusCode: 400,
    });
  }
};

export const getEditOffer = async (req, res) => {
  try {
    const offer = await Offer.findById(req.params.id);

    if (!offer) {
      setFlash(req, 'error', 'Offer not found.');

      return res.redirect('/admin/offers');
    }

    return renderOfferForm({
      req,
      res,

      mode: 'edit',

      offer,
    });
  } catch (error) {
    console.error('Edit offer page error:', error);

    setFlash(req, 'error', 'Failed to load offer.');

    res.redirect('/admin/offers');
  }
};

export const updateOffer = async (req, res) => {
  try {
    const offer = await Offer.findById(req.params.id);

    if (!offer) {
      setFlash(req, 'error', 'Offer not found.');

      return res.redirect('/admin/offers');
    }

    const { errors, value } = validateOffer(req.body);

    if (errors.length) {
      return renderOfferForm({
        req,
        res,

        mode: 'edit',

        offer: {
          ...offer.toObject(),
          ...req.body,
        },

        formErrors: errors,

        statusCode: 400,
      });
    }

    if (new Date(value.startDate) >= new Date(value.expiryDate)) {
      return renderOfferForm({
        req,
        res,

        mode: 'edit',

        offer: {
          ...offer.toObject(),
          ...req.body,
        },

        formErrors: ['Expiry date must be after start date.'],

        statusCode: 400,
      });
    }

    if (value.type === 'REFERRAL') {
      const existingReferral = await Offer.findOne({
        referralCode: value.referralCode,
        isDeleted: false,
        _id: { $ne: offer._id }
      });
      if (existingReferral) {
        return renderOfferForm({
          req,
          res,
          mode: 'edit',
          offer: { ...offer.toObject(), ...req.body },
          formErrors: ['An active offer with this referral code already exists.'],
          statusCode: 409,
        });
      }
    }

    offer.title = value.title;

    offer.type = value.type;

    offer.discountType = value.discountType;

    offer.discountValue = value.discountValue;

    offer.product = value.type === 'PRODUCT' ? value.product : null;

    offer.category = value.type === 'CATEGORY' ? value.category : null;

    offer.referralCode = value.type === 'REFERRAL' ? value.referralCode : undefined;

    offer.startDate = value.startDate;

    offer.expiryDate = value.expiryDate;

    await offer.save();

    setFlash(req, 'success', 'Offer updated successfully.');

    res.redirect('/admin/offers');
  } catch (error) {
    console.error('Update offer error:', error);

    let errorMsg = 'Failed to update offer.';
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0];
      errorMsg = `An offer with this ${field} already exists.`;
    }

    return renderOfferForm({
      req,
      res,
      mode: 'edit',
      offer: { ...offer.toObject(), ...req.body },
      formErrors: [errorMsg],
      statusCode: 400,
    });
  }
};

export const toggleOfferStatus = async (req, res) => {
  try {
    const offer = await Offer.findById(req.params.id);

    if (!offer) {
      return res.status(404).json({
        success: false,
        message: 'Offer not found.',
      });
    }

    if (offer.isDeleted) {
      return res.status(400).json({
        success: false,
        message: 'Restore this offer before changing status.',
      });
    }

    offer.isActive = !offer.isActive;

    await offer.save();

    return res.status(200).json({
      success: true,

      message: `Offer ${
        offer.isActive ? 'activated' : 'deactivated'
      } successfully.`,
    });
  } catch (error) {
    console.error('Toggle offer status error:', error);

    return res.status(500).json({
      success: false,

      message: 'Failed to update offer status.',
    });
  }
};

export const softDeleteOffer = async (req, res) => {
  try {
    const offer = await Offer.findById(req.params.id);

    if (!offer) {
      return res.status(404).json({
        success: false,

        message: 'Offer not found.',
      });
    }

    offer.isDeleted = true;

    offer.deletedAt = new Date();

    offer.isActive = false;

    await offer.save();

    return res.status(200).json({
      success: true,

      message: 'Offer moved to deleted list.',
    });
  } catch (error) {
    console.error('Delete offer error:', error);

    return res.status(500).json({
      success: false,

      message: 'Failed to delete offer.',
    });
  }
};

export const restoreOffer = async (req, res) => {
  try {
    const offer = await Offer.findById(req.params.id);
    console.log('this is offer ', offer);
    if (!offer) {
      return res.status(404).json({
        success: false,

        message: 'Offer not found.',
      });
    }

    offer.isDeleted = false;

    offer.deletedAt = null;

    offer.isActive = true;

    await offer.save();

    return res.status(200).json({
      success: true,

      message: 'Offer restored successfully.',
    });
  } catch (error) {
    console.error('Restore offer error:', error);

    return res.status(500).json({
      success: false,

      message: 'Failed to restore offer.',
    });
  }
};

export const deleteOffer = async (req, res) => {
  try {
    await Offer.findByIdAndUpdate(req.params.id, {
      isActive: false,
    });

    return res.json({
      success: true,

      message: 'Offer disabled',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
    });
  }
};
