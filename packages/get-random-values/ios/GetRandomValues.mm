#import "GetRandomValues.h"
#import <Security/Security.h>

@implementation GetRandomValues

- (NSString *)getRandomBase64:(double)byteLength {
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

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params {
    return std::make_shared<facebook::react::NativeGetRandomValuesSpecJSI>(
        params);
}

+ (NSString *)moduleName {
    return @"GetRandomValues";
}

@end
