import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BotService } from '../bot/bot.service';
import SteamTradeOfferManager from 'steam-tradeoffer-manager';
import {
  CreateTradeDto,
  CreateTradeResponse,
  GetTradesDto,
  GetTradesResponse,
  TradeOffer,
} from '@tf2-automatic/bot-data';
import { EResultException } from '../common/exceptions/eresult.exception';
import { Config, SteamAccountConfig } from '../common/config/configuration';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common/services';

@Injectable()
export class TradesService {
  private readonly logger: Logger = new Logger(TradesService.name);

  private readonly manager = this.botService.getManager();
  private readonly community = this.botService.getCommunity();

  constructor(
    private readonly botService: BotService,
    private readonly configService: ConfigService<Config>
  ) {}

  getTrades(dto: GetTradesDto): Promise<GetTradesResponse> {
    return new Promise<GetTradesResponse>((resolve, reject) => {
      this.manager.getOffers(
        dto.filter,
        (
          err: Error,
          sent: SteamTradeOfferManager.TradeOffer[],
          received: SteamTradeOfferManager.TradeOffer[]
        ) => {
          if (err) {
            return reject(err);
          }

          const sentMapped = sent.map((offer) => {
            return this.mapOffer(offer);
          });
          const receivedMapped = received.map((offer) => {
            return this.mapOffer(offer);
          });

          return resolve({ sent: sentMapped, received: receivedMapped });
        }
      );
    }).catch((err) => {
      this.logger.error(
        `Error getting trades: ${err.message}${
          err.eresult !== undefined ? ` (eresult: ${err.eresult})` : ''
        }`
      );
      throw err;
    });
  }

  getTrade(id: string): Promise<TradeOffer> {
    return new Promise<TradeOffer>((resolve, reject) => {
      this.manager.getOffer(id, (err, offer) => {
        if (err) {
          if (err.message === 'NoMatch') {
            return reject(new BadRequestException('Trade offer not found'));
          }

          return reject(err);
        }

        return resolve(this.mapOffer(offer));
      });
    }).catch((err) => {
      this.logger.error(
        `Error getting trade offer: ${err.message}${
          err.eresult !== undefined ? ` (eresult: ${err.eresult})` : ''
        }`
      );
      throw err;
    });
  }

  createTrade(dto: CreateTradeDto): Promise<CreateTradeResponse> {
    this.logger.log(`Sending trade offer to ${dto.partner}...`);

    return new Promise<CreateTradeResponse>((resolve, reject) => {
      const offer = this.manager.createOffer(dto.partner);

      if (dto.token) {
        offer.setToken(dto.token);
      }

      if (dto.message) {
        offer.setMessage(dto.message);
      }

      offer.addMyItems(dto.itemsToGive);
      offer.addTheirItems(dto.itemsToReceive);

      this.logger.debug(
        `Items to give: [${dto.itemsToGive
          .map((item) => `"${item.appid}_${item.contextid}_${item.assetid}"`)
          .join(',')}]`
      );
      this.logger.debug(
        `Items to receive: [${dto.itemsToReceive
          .map((item) => `"${item.appid}_${item.contextid}_${item.assetid}"`)
          .join(',')}]`
      );

      offer.send((err) => {
        if (err) {
          if (err.message === 'Cannot send an empty trade offer') {
            return reject(
              new BadRequestException('Cannot send an empty trade offer')
            );
          }

          if (err.eresult !== undefined) {
            return reject(new EResultException(err.message, err.eresult));
          }

          return reject(err);
        }

        return resolve(this.mapOffer(offer));
      });
    })
      .then((offer) => {
        this.logger.log(
          `Trade offer #${offer.id} sent to ${dto.partner} has status ${
            SteamTradeOfferManager.ETradeOfferState[offer.state]
          }`
        );
        return offer;
      })
      .catch((err) => {
        this.logger.error(
          `Got an error while sending trade offer: ${err.message}${
            err.eresult !== undefined ? ` (eresult: ${err.eresult})` : ''
          }`
        );
        throw err;
      });
  }

  acceptConfirmation(id: string): Promise<void> {
    this.logger.log(`Accepting confirmation for offer #${id}...`);

    return new Promise<void>((resolve, reject) => {
      this.community.acceptConfirmationForObject(
        this.configService.getOrThrow<SteamAccountConfig>('steam')
          .identitySecret,
        id,
        (err) => {
          if (err) {
            if (
              err.message ===
              'Could not find confirmation for object ' + id
            ) {
              return reject(new NotFoundException('Confirmation not found'));
            }

            return reject(err);
          }

          return resolve();
        }
      );
    })
      .then(() => {
        this.logger.log(`Accepted confirmation for offer #${id}`);
        this.manager.doPoll();
      })
      .catch((err) => {
        this.logger.error(
          `Error while accepting confirmation for ${id}: ${err.message}${
            err.eresult !== undefined ? ` (eresult: ${err.eresult})` : ''
          }`
        );
      });
  }

  removeTrade(id: string): Promise<TradeOffer> {
    this.logger.debug('Removing trade offer #' + id + '...');

    return new Promise<TradeOffer>((resolve, reject) => {
      this.manager.getOffer(id, (err, offer) => {
        if (err) {
          if (err.message === 'NoMatch') {
            return reject(new BadRequestException('Trade offer not found'));
          }

          return reject(err);
        }

        if (
          offer.state === SteamTradeOfferManager.ETradeOfferState.Active &&
          offer.state !==
            SteamTradeOfferManager.ETradeOfferState.CreatedNeedsConfirmation
        ) {
          return reject(new BadRequestException('Offer is not active'));
        }

        offer.cancel((err) => {
          if (err) {
            if (
              err.message ===
              `Offer #${offer.id} is not active, so it may not be cancelled or declined`
            ) {
              return reject(new BadRequestException('Offer is not active'));
            } else if (err.eresult !== undefined) {
              return reject(new EResultException(err.message, err.eresult));
            }

            return reject(err);
          }

          return resolve(this.mapOffer(offer));
        });
      });
    })
      .then((offer) => {
        this.logger.debug('Removed trade offer #' + id);
        return offer;
      })
      .catch((err) => {
        this.logger.error(
          `Error while removing trade offer #${id}: ${err.message}${
            err.eresult !== undefined ? ` (eresult: ${err.eresult})` : ''
          }`
        );
        throw err;
      });
  }

  private mapOffer(offer: SteamTradeOfferManager.TradeOffer): TradeOffer {
    return {
      partner: offer.partner.getSteamID64(),
      id: offer.id,
      message: offer.message,
      state: offer.state,
      itemsToGive: offer.itemsToGive,
      itemsToReceive: offer.itemsToReceive,
      isGlitched: offer.isGlitched(),
      isOurOffer: offer.isOurOffer,
      createdAt: Math.floor(offer.created.getTime() / 1000),
      updatedAt: Math.floor(offer.updated.getTime() / 1000),
      expiresAt: Math.floor(offer.expires.getTime() / 1000),
      tradeID: offer.tradeID,
      fromRealTimeTrade: offer.fromRealTimeTrade,
      confirmationMethod: offer.confirmationMethod,
      escrowEndsAt:
        offer.escrowEnds === null
          ? null
          : Math.floor(offer.escrowEnds.getTime() / 1000),
    };
  }
}
