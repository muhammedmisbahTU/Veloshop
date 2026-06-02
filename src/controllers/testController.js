import User from "../models/User.js";

export const createUser = async (
  req,
  res
) => {

  const user =
  await User.create({

    fullName: "Misbah",

    email:
    "misbah@gmail.com",

    password:
    "123456",

    referralId:
    "MISBAH001"
  });

  res.json(user);
};