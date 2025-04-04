import { UnrecoverableError } from 'bullmq';
import {
  CustomError,
  CustomUnrecoverableError,
  extractErrorMessage,
} from './errors';

describe('Errors', () => {
  describe('CustomError', () => {
    it('should use the http error message and status code', () => {
      const error = new CustomError('Test error', {
        message: 'Something something',
        statusCode: 500,
      });

      expect(error.message).toBe(
        'Upstream error: Something something (HTTP 500)',
      );
    });

    it('should use the http error message without status code', () => {
      const error = new CustomError('Test error', {
        message: 'Something something',
      });

      expect(error.message).toBe('Upstream error: Something something');
    });

    it('should not extend UnrecoverableError', () => {
      const error = new CustomError('Test error', {
        message: 'Something something',
      });

      expect(error).toBeInstanceOf(Error);
      expect(error).not.toBeInstanceOf(UnrecoverableError);
    });
  });

  describe('CustomUnrecoverableError', () => {
    it('should use the http error message and status code', () => {
      const error = new CustomUnrecoverableError('Test error', {
        message: 'Something something',
        statusCode: 500,
      });

      expect(error.message).toBe(
        'Upstream error: Something something (HTTP 500)',
      );
    });

    it('should use the http error message without status code', () => {
      const error = new CustomUnrecoverableError('Test error', {
        message: 'Something something',
      });

      expect(error.message).toBe('Upstream error: Something something');
    });

    it('should extend UnrecoverableError', () => {
      const error = new CustomUnrecoverableError('Test error', {
        message: 'Something something',
      });

      expect(error).toBeInstanceOf(UnrecoverableError);
    });
  });

  describe('extractErrorMessage', () => {
    it('should extract the message from an upstream error without a http status', () => {
      const error = new CustomError('Upstream', {
        message: 'Something something',
      });

      expect(extractErrorMessage(error)).toEqual({
        message: 'Something something',
      });
    });

    it('should extract the message from an upstream error with a http status', () => {
      const error = new CustomError('Upstream', {
        message: 'Something something',
        statusCode: 500,
      });

      expect(extractErrorMessage(error)).toEqual({
        message: 'Something something',
        statusCode: 500,
      });
    });

    it('should return an empty object if it is not an upstream error', () => {
      const error = new Error('Test error');

      expect(extractErrorMessage(error)).toEqual({});
    });
  });
});
