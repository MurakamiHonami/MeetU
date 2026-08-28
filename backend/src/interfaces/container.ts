import { Env } from "./middleware/auth";
import { createDb } from "../infrastructure/db/database";
import { D1CardRepository } from "../infrastructure/db/d1/D1CardRepository";
import { D1TagRepository } from "../infrastructure/db/d1/D1TagRepository";
import { D1MatchRepository } from "../infrastructure/db/d1/D1MatchRepository";
import { D1UserRepository } from "../infrastructure/db/d1/D1UserRepository";
import { D1MessageRepository } from "../infrastructure/db/d1/D1MessageRepository";
import { D1ReviewRepository } from "../infrastructure/db/d1/D1ReviewRepository";
import { D1ReportRepository } from "../infrastructure/db/d1/D1ReportRepository";
import { D1GroupRepository } from "../infrastructure/db/d1/D1GroupRepository";
import { D1SwipeRepository } from "../infrastructure/db/d1/D1SwipeRepository";
import { R2UploadService } from "../infrastructure/storage/R2UploadService";
import { CardUseCase } from "../usecase/CardUseCase";
import { MatchUseCase } from "../usecase/MatchUseCase";
import { UserUseCase } from "../usecase/UserUseCase";
import { MessageUseCase } from "../usecase/MessageUseCase";
import { ReviewUseCase } from "../usecase/ReviewUseCase";
import { ReportUseCase } from "../usecase/ReportUseCase";
import { GroupUseCase } from "../usecase/GroupUseCase";
import { FeedUseCase } from "../usecase/FeedUseCase";
import { NearbyUseCase } from "../usecase/NearbyUseCase";
import { UploadUseCase } from "../usecase/UploadUseCase";

export function createContext(env: Env["Bindings"], baseUrl: string) {
  const db = createDb(env.DB);
  const cardRepo = new D1CardRepository(db);
  const tagRepo = new D1TagRepository(db);
  const matchRepo = new D1MatchRepository(db);
  const userRepo = new D1UserRepository(db);
  const messageRepo = new D1MessageRepository(db);
  const reviewRepo = new D1ReviewRepository(db);
  const reportRepo = new D1ReportRepository(db);
  const groupRepo = new D1GroupRepository(db);
  const swipeRepo = new D1SwipeRepository(db);
  const uploadService = new R2UploadService(env.UPLOADS_R2, env.CACHE_KV, baseUrl);

  return {
    repos: {
      cardRepo,
      tagRepo,
      matchRepo,
      userRepo,
      messageRepo,
      reviewRepo,
      reportRepo,
      groupRepo,
      swipeRepo,
    },
    uploadService,
    useCases: {
      card: new CardUseCase(cardRepo, tagRepo, matchRepo, userRepo, groupRepo),
      match: new MatchUseCase(matchRepo, cardRepo, userRepo),
      user: new UserUseCase(userRepo, cardRepo, reviewRepo),
      message: new MessageUseCase(messageRepo, matchRepo, groupRepo, userRepo, uploadService),
      review: new ReviewUseCase(reviewRepo, matchRepo, userRepo),
      report: new ReportUseCase(reportRepo, userRepo),
      group: new GroupUseCase(groupRepo, cardRepo, userRepo),
      feed: new FeedUseCase(cardRepo, tagRepo, swipeRepo, userRepo),
      nearby: new NearbyUseCase(cardRepo, userRepo),
      upload: new UploadUseCase(uploadService, matchRepo, groupRepo),
    },
  };
}

export type AppContext = ReturnType<typeof createContext>;
