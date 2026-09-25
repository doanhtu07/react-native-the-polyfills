#import "GetRandomValues.h"
#import <Security/Security.h>

@implementation GetRandomValues

RCT_EXPORT_MODULE(GetRandomValues)

+ (BOOL)requiresMainQueueSetup {
    return NO;
}

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(getRandomBase64 : (double)byteLength) {
    NSInteger length = (NSInteger)byteLength;

    if (length < 0) {
        return nil;
    }

    if (length == 0) {
        return @"";
    }

    NSMutableData *data = [NSMutableData dataWithLength:(NSUInteger)length];

    int status = SecRandomCopyBytes(kSecRandomDefault, (size_t)length,
                                    data.mutableBytes);

    if (status != errSecSuccess) {
        return nil;
    }

    return [data base64EncodedStringWithOptions:0];
}

@end
