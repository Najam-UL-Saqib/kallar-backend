import { asyncHandler } from "../utils/asyncHandler.js";
import { env } from "../config/env.js";
import { getIslamicContent } from "../services/islamicService.js";
import {
  getOnThisDay, getRandomCat, getRandomDog, getRandomMeme, getBoredActivity, getApod,
} from "../services/discoverService.js";

export const islamic   = asyncHandler(async (req, res) => res.json(await getIslamicContent()));
export const onThisDay = asyncHandler(async (req, res) => res.json(await getOnThisDay()));
export const cat       = asyncHandler(async (req, res) => res.json(await getRandomCat()));
export const dog       = asyncHandler(async (req, res) => res.json(await getRandomDog()));
export const meme      = asyncHandler(async (req, res) => res.json(await getRandomMeme()));
export const bored     = asyncHandler(async (req, res) => res.json(await getBoredActivity()));
export const apod      = asyncHandler(async (req, res) => res.json(await getApod(env.nasaApiKey)));
